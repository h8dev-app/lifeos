<script lang="ts">
  import { onMount } from "svelte";
  import NoteEditor from "../components/NoteEditor.svelte";
  import { app, guard, say } from "../lib/app.svelte";
  import { createNote, deleteNote, listNotes, syncNotes, type NoteMeta } from "../lib/db/notes";
  import { formatWhen } from "../lib/clock";

  let notes = $state<NoteMeta[]>([]);
  let search = $state("");
  let selected = $state<NoteMeta | null>(null);

  async function refresh() {
    notes = (await guard(() => listNotes(search))) ?? [];
    if (app.openNoteId) {
      selected = notes.find((n) => n.id === app.openNoteId) ?? selected;
      app.openNoteId = null;
    }
  }

  onMount(async () => {
    await guard(syncNotes);
    await refresh();
  });

  // Search as you type; also re-read when `/note <titre>` asks to open a note.
  $effect(() => { search; app.openNoteId; refresh(); });

  async function create() {
    const n = await guard(() => createNote("Nouvelle note"));
    if (n) { search = ""; selected = n; await refresh(); }
  }

  // Delete in two clicks: × then "Confirmer".
  let pendingDelete = $state<string | null>(null);

  async function remove(n: NoteMeta) {
    if (pendingDelete !== n.id) { pendingDelete = n.id; return; }
    pendingDelete = null;
    await guard(() => deleteNote(n));
    if (selected?.id === n.id) selected = null;
    say("Note déplacée dans notes/.trash.");
    await refresh();
  }

  function onsaved(n: NoteMeta) {
    notes = notes.map((x) => (x.id === n.id ? n : x));
    if (selected?.id === n.id) selected = n;
  }
</script>

<div class="notes">
  <aside>
    <input class="search" placeholder="Rechercher…" bind:value={search} aria-label="Rechercher dans les notes" />
    <button class="new" onclick={create}>+ Nouvelle note</button>
    <ul>
      {#each notes as n (n.id)}
        <li class:active={selected?.id === n.id}>
          <button class="item" onclick={() => (selected = n)}>
            <span class="t">{n.title}</span>
            <span class="w">{formatWhen(n.updatedAt)}</span>
          </button>
          <button class="del" class:confirm={pendingDelete === n.id} onclick={() => remove(n)}
            onblur={() => (pendingDelete = null)} aria-label="Supprimer">
            {pendingDelete === n.id ? "Confirmer ?" : "×"}
          </button>
        </li>
      {:else}
        <li class="empty">{search ? "Aucun résultat." : "Aucune note. /note <titre>"}</li>
      {/each}
    </ul>
  </aside>
  <div class="main">
    {#if selected}
      <NoteEditor note={selected} {onsaved} />
    {:else}
      <p class="empty">Choisis une note ou crée-en une.</p>
    {/if}
  </div>
</div>

<style>
  .notes { display: grid; grid-template-columns: 260px 1fr; gap: 20px; height: 100%; max-width: 1200px; margin: 0 auto; }
  aside { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .search {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; color: var(--text); outline: none; font: inherit;
  }
  .search:focus { border-color: var(--accent); }
  .new {
    background: none; border: 1px dashed var(--border); color: var(--text-muted);
    border-radius: 8px; padding: 6px; cursor: pointer;
  }
  .new:hover { color: var(--text); border-color: var(--accent); }
  ul { list-style: none; margin: 0; padding: 0; overflow: auto; display: flex; flex-direction: column; gap: 4px; }
  li { display: flex; border-radius: 8px; }
  li.active, li:hover { background: var(--surface); }
  .item {
    flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    background: none; border: none; color: var(--text); text-align: left; padding: 8px 10px; cursor: pointer; min-width: 0;
  }
  .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .w { font-size: 12px; color: var(--text-muted); }
  .del { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; opacity: 0; }
  li:hover .del { opacity: 1; }
  .del:hover, .del.confirm { color: var(--error); opacity: 1; font-size: 12px; }
  .main { min-height: 0; }
  .empty { color: var(--text-muted); padding: 8px 10px; }
</style>
