<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import { onDestroy } from "svelte";
  import { guard, say } from "../lib/app.svelte";
  import { readNote, saveNote, type NoteMeta } from "../lib/db/notes";
  import { onBeforeHide } from "../lib/overlay";
  import { openUrl } from "@tauri-apps/plugin-opener";

  // GitHub-flavoured Markdown; a single line break stays a line break (like a notepad).
  marked.use({ gfm: true, breaks: true });

  // Markdown editor with autosave (0.6 s after the last key) and preview.
  let { note, onsaved }: { note: NoteMeta; onsaved: (n: NoteMeta) => void } = $props();

  let content = $state("");
  let loadedId = $state<string | null>(null);
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let preview = $state(false);
  let area: HTMLTextAreaElement | undefined = $state();

  // Load when the selected note changes (after saving the previous one).
  $effect(() => {
    const target = note;
    if (target.id === loadedId) return;
    (async () => {
      await flush();
      const text = await guard(() => readNote(target.path));
      content = text ?? "";
      loadedId = target.id;
      current = target;
      dirty = false;
      preview = false;
      queueMicrotask(() => area?.focus());
    })();
  });

  // Note whose text is in the textarea (may differ from `note` while switching).
  let current: NoteMeta | null = null;
  $effect(() => { if (note.id === loadedId) current = note; });

  async function flush() {
    clearTimeout(timer);
    const target = current;
    if (!dirty || !target) return;
    dirty = false;
    const saved = await guard(() => saveNote(target, content));
    if (saved) onsaved(saved);
    else say("Note non enregistrée.", "error");
  }

  function oninput() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }

  // On the window, so Ctrl+E also works from the preview (no textarea there).
  function onWindowKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
      e.preventDefault();
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

  const unregister = onBeforeHide(flush);
  onDestroy(() => { unregister(); flush(); });

  const html = $derived(preview ? DOMPurify.sanitize(marked.parse(content, { async: false })) : "");
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="editor">
  <div class="bar">
    <span class="title">{note.title}</span>
    <button onclick={togglePreview} title="Ctrl+E">{preview ? "Éditer" : "Aperçu"}</button>
  </div>
  {#if preview}
    <!-- Sanitized with DOMPurify. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="md" onclick={onPreviewClick}>{@html html}</article>
  {:else}
    <textarea bind:this={area} bind:value={content} {oninput} onblur={flush} spellcheck="true"></textarea>
  {/if}
</div>

<style>
  .editor { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .title { color: var(--text-muted); font-size: 13px; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 6px; padding: 3px 10px; cursor: pointer; font-size: 13px;
  }
  textarea, .md {
    flex: 1; min-height: 0; overflow: auto;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; color: var(--text);
  }
  textarea { resize: none; outline: none; font: 15px/1.6 var(--mono); }
  textarea:focus { border-color: var(--accent); }
  /* Typography of the rendered Markdown (the global reset removes browser defaults). */
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
