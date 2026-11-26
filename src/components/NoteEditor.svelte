<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import { onDestroy, onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { guard, say } from "../lib/app.svelte";
  import { readNote, saveNote, type NoteMeta } from "../lib/db/notes";
  import { onBeforeHide } from "../lib/overlay";
  import { formatWhen } from "../lib/clock";

  // GitHub-flavoured Markdown; a single line break stays a line break (like a notepad).
  marked.use({ gfm: true, breaks: true });

  // One open note (the parent remounts this component for each note).
  // Autosave 0.6 s after the last key, on blur, on close and before the overlay hides.
  let {
    note, folders, onsaved, onclose, onmove, ondelete,
  }: {
    note: NoteMeta;
    folders: string[];
    onsaved: (n: NoteMeta) => void;
    onclose: () => void;
    onmove: (folder: string) => void;
    ondelete: () => void;
  } = $props();

  let content = $state("");
  let loaded = $state(false);
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let preview = $state(false);
  let confirmDelete = $state(false);
  let saving = $state(false);
  let area: HTMLTextAreaElement | undefined = $state();

  onMount(async () => {
    content = (await guard(() => readNote(note.path))) ?? "";
    loaded = true;
    queueMicrotask(() => {
      area?.focus();
      // Cursor at the end, ready to write under the title.
      area?.setSelectionRange(content.length, content.length);
    });
  });

  export async function flush() {
    clearTimeout(timer);
    if (!dirty || !loaded) return;
    dirty = false;
    saving = true;
    const saved = await guard(() => saveNote(note, content));
    saving = false;
    if (saved) onsaved(saved);
    else say("Note non enregistrée.", "error");
  }

  function oninput() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }

  async function close() {
    await flush();
    onclose();
  }

  // Escape closes the note (the overlay stays open); Ctrl+E toggles the preview.
  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (confirmDelete) confirmDelete = false;
      else close();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
      e.preventDefault();
      e.stopPropagation();
      togglePreview();
    }
  }

  function togglePreview() {
    preview = !preview;
    if (!preview) queueMicrotask(() => area?.focus());
  }

  // A link in the preview would load the site inside the overlay and replace
  // the app. Open it in the system browser instead.
  function onPreviewClick(e: MouseEvent) {
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (/^(https?:|mailto:)/i.test(href)) openUrl(href).catch((err) => say(`Lien non ouvert : ${err}`, "error"));
  }

  async function move(folder: string) {
    await flush();
    onmove(folder);
  }

  const unregister = onBeforeHide(flush);
  onDestroy(() => { unregister(); flush(); });

  const html = $derived(preview ? DOMPurify.sanitize(marked.parse(content, { async: false })) : "");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="editor" {onkeydown}>
  <header>
    <div class="crumbs">
      <span class="folder">{note.folder || "Sans catégorie"}</span>
      <span class="sep">/</span>
      <span class="title">{note.title}</span>
      <span class="state">{saving ? "Enregistrement…" : `Modifiée ${formatWhen(note.updatedAt)}`}</span>
    </div>
    <div class="tools">
      <select aria-label="Catégorie" value={note.folder} onchange={(e) => move(e.currentTarget.value)}>
        <option value="">Sans catégorie</option>
        {#each folders as f (f)}<option value={f}>{f}</option>{/each}
      </select>
      <div class="seg" role="group" aria-label="Mode">
        <button class:on={!preview} onclick={() => preview && togglePreview()}>Écrire</button>
        <button class:on={preview} onclick={() => !preview && togglePreview()} title="Ctrl+E">Aperçu</button>
      </div>
      {#if confirmDelete}
        <button class="danger" onclick={ondelete}>Confirmer</button>
        <button onclick={() => (confirmDelete = false)}>Annuler</button>
      {:else}
        <button class="icon" onclick={() => (confirmDelete = true)} title="Mettre à la corbeille" aria-label="Supprimer">🗑</button>
      {/if}
      <button class="icon close" onclick={close} title="Fermer (Échap)" aria-label="Fermer la note">✕</button>
    </div>
  </header>

  {#if !loaded}
    <p class="muted">Chargement…</p>
  {:else if preview}
    <!-- Sanitized with DOMPurify. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="md" tabindex="-1" onclick={onPreviewClick}>{@html html}</article>
  {:else}
    <textarea bind:this={area} bind:value={content} {oninput} onblur={flush} spellcheck="true"
      placeholder="Écris en Markdown : # titre, - liste, **gras**, - [ ] tâche…"></textarea>
  {/if}
  <p class="foot">Échap : fermer la note · Ctrl+E : aperçu · sauvegarde automatique</p>
</div>

<style>
  .editor { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .crumbs { display: flex; align-items: baseline; gap: 6px; min-width: 0; flex: 1; }
  .folder { color: var(--text-muted); font-size: 14px; white-space: nowrap; }
  .sep { color: var(--border); }
  .title { font-size: 18px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .state { color: var(--text-muted); font-size: 12px; margin-left: 8px; white-space: nowrap; }
  .tools { display: flex; align-items: center; gap: 6px; }
  select, button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 5px 10px; cursor: pointer; font: inherit; font-size: 13px;
  }
  button:hover, select:hover { border-color: var(--accent); }
  .seg { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button { border: none; border-radius: 0; background: transparent; color: var(--text-muted); }
  .seg button.on { background: var(--surface-strong); color: var(--text); }
  .icon { width: 32px; padding: 5px 0; text-align: center; }
  .close { font-size: 15px; }
  .danger { color: var(--error); border-color: var(--error); }
  textarea, .md {
    flex: 1; min-height: 0; overflow: auto; width: 100%;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 20px 24px; color: var(--text);
  }
  textarea { resize: none; outline: none; font: 15px/1.7 var(--mono); }
  textarea:focus { border-color: var(--accent); }
  .md { outline: none; }
  .foot { margin: 0; color: var(--text-muted); font-size: 12px; }
  .muted { color: var(--text-muted); }
  .md { line-height: 1.6; font-size: 15px; overflow-wrap: anywhere; }
  .md :global(> :first-child) { margin-top: 0; }
  .md :global(h1) { font-size: 1.7em; font-weight: 600; margin: 0.8em 0 0.4em; }
  .md :global(h2) { font-size: 1.35em; font-weight: 600; margin: 0.9em 0 0.4em; }
  .md :global(h3) { font-size: 1.1em; font-weight: 600; margin: 0.9em 0 0.3em; }
  .md :global(p) { margin: 0.5em 0; }
  .md :global(ul), .md :global(ol) { margin: 0.4em 0; padding-left: 1.6em; }
  .md :global(li) { margin: 0.15em 0; }
  .md :global(li:has(> input[type="checkbox"])) { list-style: none; margin-left: -1.3em; }
  .md :global(input[type="checkbox"]) { margin-right: 6px; accent-color: var(--accent); }
  .md :global(blockquote) { margin: 0.6em 0; padding: 2px 12px; border-left: 3px solid var(--accent); color: var(--text-muted); }
  .md :global(a) { color: var(--accent); cursor: pointer; }
  .md :global(code) { font-family: var(--mono); font-size: 0.9em; background: var(--surface-strong); padding: 1px 5px; border-radius: 4px; }
  .md :global(pre) { background: var(--surface-strong); padding: 12px; border-radius: 8px; overflow: auto; }
  .md :global(pre code) { background: none; padding: 0; }
  .md :global(hr) { border: none; border-top: 1px solid var(--border); margin: 1.2em 0; }
  .md :global(table) { border-collapse: collapse; margin: 0.6em 0; }
  .md :global(th), .md :global(td) { border: 1px solid var(--border); padding: 4px 10px; }
  .md :global(img) { max-width: 100%; }
</style>
