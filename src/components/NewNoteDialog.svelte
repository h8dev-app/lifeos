<script lang="ts">
  import { onMount } from "svelte";
  import { sanitizeFolderName } from "../lib/notes/markdown";
  import Select from "./Select.svelte";

  // Asks for a name (required) and a category before creating a note.
  let {
    folders, defaultFolder = "", oncreate, oncancel,
  }: {
    folders: string[];
    defaultFolder?: string;
    oncreate: (title: string, folder: string) => void;
    oncancel: () => void;
  } = $props();

  const NEW = "__new__";
  let title = $state("");
  // Initial value only: the dialog is created fresh each time.
  // svelte-ignore state_referenced_locally
  let choice = $state(defaultFolder);
  let newFolder = $state("");
  let input: HTMLInputElement;

  onMount(() => input.focus());

  const folder = $derived(choice === NEW ? sanitizeFolderName(newFolder) : choice);
  const valid = $derived(title.trim().length > 0 && (choice !== NEW || folder.length > 0));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (valid) oncreate(title.trim(), folder);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // do not close the overlay
      oncancel();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={oncancel} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="nn-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
  <form onsubmit={submit}>
    <h2 id="nn-title">Nouvelle note</h2>

    <label for="nn-name">Nom</label>
    <input id="nn-name" bind:this={input} bind:value={title} placeholder="ex. Révisions réseau" autocomplete="off" />

    <span class="label">Catégorie</span>
    <Select label="Catégorie" bind:value={choice} options={[
      { value: "", label: "Sans catégorie" },
      ...folders.map((f) => ({ value: f, label: f })),
      { value: NEW, label: "+ Nouvelle catégorie…" },
    ]} />
    {#if choice === NEW}
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={newFolder} placeholder="Nom de la catégorie (ex. Cours)" aria-label="Nouvelle catégorie" autofocus />
    {/if}

    <div class="actions">
      <button type="button" onclick={oncancel}>Annuler</button>
      <button type="submit" class="primary" disabled={!valid}>Créer</button>
    </div>
  </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 10;
    background: var(--backdrop);
    display: flex; align-items: flex-start; justify-content: center; padding-top: 18vh;
  }
  .dialog {
    width: min(440px, calc(100% - 32px));
    background: var(--glass-bg-strong); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); box-shadow: var(--glass-rim), var(--glass-shadow); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 20px; box-shadow: var(--shadow);
  }
  form { display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; }
  label, .label { color: var(--text-muted); font-size: 13px; margin-top: 4px; }
  form :global(.select) { display: flex; }
  form :global(.trigger) { padding: 9px 11px; }
  input {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; color: var(--text); font: inherit; outline: none;
  }
  input:focus { border-color: var(--accent); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 7px 16px; cursor: pointer; font: inherit;
  }
  .primary { border-color: var(--accent); color: var(--accent); }
  .primary:disabled { opacity: 0.4; cursor: default; }
</style>
