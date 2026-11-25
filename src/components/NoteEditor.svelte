<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import { onDestroy } from "svelte";
  import { guard, say } from "../lib/app.svelte";
  import { readNote, saveNote, type NoteMeta } from "../lib/db/notes";
  import { onBeforeHide } from "../lib/overlay";

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

  function onkeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
      e.preventDefault();
      preview = !preview;
    }
  }

  const unregister = onBeforeHide(flush);
  onDestroy(() => { unregister(); flush(); });

  const html = $derived(preview ? DOMPurify.sanitize(marked.parse(content, { async: false })) : "");
</script>

<div class="editor">
  <div class="bar">
    <span class="title">{note.title}</span>
    <button onclick={() => (preview = !preview)} title="Ctrl+E">{preview ? "Éditer" : "Aperçu"}</button>
  </div>
  {#if preview}
    <!-- Sanitized with DOMPurify. -->
    <article class="md">{@html html}</article>
  {:else}
    <textarea bind:this={area} bind:value={content} {oninput} {onkeydown} onblur={flush} spellcheck="true"></textarea>
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
  .md { line-height: 1.6; }
  .md :global(a) { color: var(--accent); }
  .md :global(code) { font-family: var(--mono); background: var(--surface-strong); padding: 1px 4px; border-radius: 4px; }
  .md :global(pre) { background: var(--surface-strong); padding: 12px; border-radius: 8px; overflow: auto; }
</style>
