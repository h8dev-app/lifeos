<script lang="ts">
  import { onMount } from "svelte";
  import NoteEditor from "../components/NoteEditor.svelte";
  import NewNoteDialog from "../components/NewNoteDialog.svelte";
  import { app, guard, say } from "../lib/app.svelte";
  import { createFolder, createNote, deleteNote, listFolders, listNotes, moveNote, syncNotes, type NoteMeta } from "../lib/db/notes";
  import { formatWhen } from "../lib/clock";

  const ALL = "__all__";

  let notes = $state<NoteMeta[]>([]);
  let folders = $state<string[]>([]);
  let search = $state("");
  let filter = $state<string>(ALL); // ALL, "" (no category) or a folder
  let openId = $state<string | null>(null);
  let creating = $state(false);
  let newFolderMode = $state(false);
  let newFolderName = $state("");

  const open = $derived(notes.find((n) => n.id === openId) ?? null);
  const visible = $derived(filter === ALL ? notes : notes.filter((n) => n.folder === filter));
  const count = (f: string) => notes.filter((n) => n.folder === f).length;
  const uncategorized = $derived(count(""));

  async function refresh() {
    const [list, dirs] = await Promise.all([guard(() => listNotes(search)), guard(listFolders)]);
    notes = list ?? [];
    folders = dirs ?? [];
    if (app.openNoteId) {
      const target = notes.find((n) => n.id === app.openNoteId);
      if (target) { openId = target.id; filter = ALL; }
      app.openNoteId = null;
    }
  }

  onMount(async () => {
    await guard(syncNotes);
    await refresh();
  });

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
  <aside>
    <button class="new" onclick={() => (creating = true)}>＋ Nouvelle note</button>
    <input class="search" placeholder="Rechercher dans les notes…" bind:value={search} aria-label="Rechercher" />

    <nav aria-label="Catégories">
      <button class="cat" class:active={filter === ALL} onclick={() => { filter = ALL; openId = null; }}>
        <span>Toutes les notes</span><span class="n">{notes.length}</span>
      </button>
      {#each folders as f (f)}
        <button class="cat" class:active={filter === f} onclick={() => { filter = f; openId = null; }}>
          <span>📁 {f}</span><span class="n">{count(f)}</span>
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
        <button class="cat add" onclick={() => (newFolderMode = true)}>＋ Catégorie</button>
      {/if}
    </nav>
  </aside>

  <main>
    {#if open}
      {#key open.id}
        <NoteEditor note={open} {folders} {onsaved}
          onclose={() => (openId = null)}
          onmove={(f) => move(open, f)}
          ondelete={() => remove(open)} />
      {/key}
    {:else}
      <h2>
        {filter === ALL ? (search ? `Résultats pour « ${search} »` : "Toutes les notes") : filter || "Sans catégorie"}
        <span class="n">{visible.length}</span>
      </h2>
      {#if visible.length === 0}
        <div class="empty">
          <p>{search ? "Aucune note ne correspond." : "Aucune note ici."}</p>
          <button class="new" onclick={() => (creating = true)}>＋ Créer une note</button>
        </div>
      {:else}
        <div class="cards">
          {#each visible as n (n.id)}
            <button class="card" onclick={() => (openId = n.id)}>
              <span class="t">{n.title}</span>
              <span class="x">{n.excerpt || "Note vide"}</span>
              <span class="meta">
                {#if filter === ALL}<span class="tag">{n.folder || "Sans catégorie"}</span>{/if}
                <span>{formatWhen(n.updatedAt)}</span>
              </span>
            </button>
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
  aside { display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow: auto; }
  .new {
    background: var(--accent); color: #0c0e14; border: none; border-radius: 8px;
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
  main { min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: auto; }
  h2 { margin: 0 0 14px; font-size: 18px; font-weight: 600; display: flex; gap: 8px; align-items: baseline; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .card {
    display: flex; flex-direction: column; gap: 6px; text-align: left; min-height: 120px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; color: var(--text); cursor: pointer; font: inherit;
  }
  .card:hover { border-color: var(--accent); background: var(--surface-strong); }
  .t { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { color: var(--text-muted); font-size: 13px; line-height: 1.4; flex: 1;
    display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .meta { display: flex; justify-content: space-between; gap: 8px; color: var(--text-muted); font-size: 12px; }
  .tag { padding: 1px 8px; border-radius: 999px; background: var(--surface-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: var(--text-muted); display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
</style>
