<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import Select from "./Select.svelte";
  import type { ProjectInput } from "../lib/db/projects";
  import {
    parseKeywords, parseRepo, PROJECT_COLORS, PROJECT_ICONS, PROJECT_STATUSES, type Project, type ProjectStatus,
  } from "../lib/projects/projects";
  import type { IconName } from "../lib/ui/iconNames";

  // Create or edit a project. `project` null = creation.
  let { project = null, onsave, ondelete, oncancel }: {
    project?: Project | null;
    onsave: (p: ProjectInput) => void;
    ondelete?: () => void;
    oncancel: () => void;
  } = $props();

  // Initial values only: the dialog is created fresh each time.
  // svelte-ignore state_referenced_locally
  const src = project;
  let name = $state(src?.name ?? "");
  let icon = $state<IconName | null>(src?.icon ?? "briefcase");
  let color = $state(src?.color ?? PROJECT_COLORS[0]);
  let status = $state<ProjectStatus>(src?.status ?? "active");
  let dueDate = $state(src?.dueDate ?? "");
  let description = $state(src?.description ?? "");
  let folder = $state(src?.folder ?? "");
  let repo = $state(src?.repo ?? "");
  let keywords = $state(src?.keywords.join(", ") ?? "");
  let confirmDelete = $state(false);
  let input: HTMLInputElement;

  onMount(() => input.focus());

  const repoError = $derived(repo.trim() && !parseRepo(repo) ? "Dépôt : owner/nom ou lien github.com." : "");
  const valid = $derived(name.trim().length > 0 && !repoError);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    onsave({
      name: name.trim(), icon, color, status,
      dueDate: dueDate || null,
      description: description.trim() || null,
      notesFolder: src?.notesFolder ?? null,
      folder: folder.trim() || null,
      repo: parseRepo(repo),
      keywords: parseKeywords(keywords || name),
    });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); oncancel(); }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={oncancel} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog glass-strong" role="dialog" aria-modal="true" aria-labelledby="pd-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <form onsubmit={submit}>
      <h2 id="pd-title">{project ? "Modifier le projet" : "Nouveau projet"}</h2>

      <div class="namerow">
        <span class="preview" style:background={color}>{#if icon}<Icon name={icon} size={18} />{/if}</span>
        <input class="name" bind:this={input} bind:value={name} placeholder="Nom du projet" aria-label="Nom" autocomplete="off" />
      </div>

      <span class="label">Icône</span>
      <div class="icons" role="radiogroup" aria-label="Icône">
        {#each PROJECT_ICONS as ic (ic)}
          <button type="button" role="radio" aria-checked={icon === ic} class:on={icon === ic} onclick={() => (icon = ic)} title={ic}>
            <Icon name={ic} size={16} />
          </button>
        {/each}
      </div>

      <span class="label">Couleur</span>
      <div class="colors" role="radiogroup" aria-label="Couleur">
        {#each PROJECT_COLORS as c (c)}
          <button type="button" role="radio" aria-checked={color === c} aria-label={c} class:on={color === c}
            style:background={c} onclick={() => (color = c)}></button>
        {/each}
      </div>

      <div class="row">
        <div class="field">
          <span class="label">Statut</span>
          <Select label="Statut" value={status} onchange={(v) => (status = v as ProjectStatus)}
            options={PROJECT_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
        <label class="field">
          <span class="label">Échéance</span>
          <input type="date" bind:value={dueDate} />
        </label>
      </div>

      <label class="field">
        <span class="label">Description</span>
        <textarea bind:value={description} rows="2" placeholder="Optionnel"></textarea>
      </label>

      <details open={!!(src?.folder || src?.repo)}>
        <summary>Liens : dossier, GitHub, temps passé</summary>
        <label class="field">
          <span class="label">Dossier du projet (ouvert dans Claude)</span>
          <input bind:value={folder} placeholder="~/projets/mon-projet" spellcheck="false" />
        </label>
        <label class="field">
          <span class="label">Dépôt GitHub</span>
          <input bind:value={repo} placeholder="owner/nom ou https://github.com/…" spellcheck="false" />
        </label>
        {#if repoError}<p class="err">{repoError}</p>{/if}
        <label class="field">
          <span class="label">Mots-clés du temps passé (séparés par des virgules)</span>
          <input bind:value={keywords} placeholder={name ? name.toLowerCase() : "lifeos, tauri"} spellcheck="false" />
        </label>
        <p class="hint">Une fenêtre (ActivityWatch) dont le titre ou l'appli contient un mot-clé compte pour ce projet.</p>
      </details>

      <div class="actions">
        {#if project && ondelete}
          {#if confirmDelete}
            <button type="button" class="danger" onclick={ondelete}>Confirmer la suppression</button>
          {:else}
            <button type="button" class="ghost" onclick={() => (confirmDelete = true)}><Icon name="trash-2" size={14} /> Supprimer</button>
          {/if}
        {/if}
        <span class="grow"></span>
        <button type="button" onclick={oncancel}>Annuler</button>
        <button type="submit" class="primary" disabled={!valid}>{project ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 10; background: var(--backdrop);
    display: flex; align-items: flex-start; justify-content: center; padding-top: 6vh;
  }
  .dialog {
    width: min(520px, calc(100% - 32px)); border-radius: var(--radius); padding: 20px;
    max-height: 88vh; overflow: auto;
  }
  form { display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0 0 6px; font-size: 18px; }
  .label { display: block; color: var(--text-muted); font-size: 13px; margin: 4px 0 4px; }
  .field { display: flex; flex-direction: column; flex: 1; }
  .field :global(.select) { display: flex; }
  .field :global(.trigger) { padding: 9px 11px; }
  .row { display: flex; gap: 10px; align-items: flex-end; }
  .namerow { display: flex; gap: 10px; align-items: center; }
  .preview {
    display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; color: #fff;
  }
  input:not([type="checkbox"]), textarea {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; color: var(--text); font: inherit; outline: none; color-scheme: inherit; resize: vertical;
  }
  .name { flex: 1; font-size: 16px; }
  input:focus, textarea:focus { border-color: var(--accent); }
  .icons { display: flex; flex-wrap: wrap; gap: 4px; }
  .icons button {
    display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border-radius: 8px;
    background: var(--surface); border: 1px solid transparent; color: var(--text-muted);
  }
  .icons button.on { border-color: var(--accent); color: var(--accent); }
  .colors { display: flex; gap: 8px; }
  .colors button { width: 24px; height: 24px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
  .colors button.on { border-color: var(--text); box-shadow: 0 0 0 2px var(--popup) inset; }
  details { margin-top: 4px; }
  summary { cursor: pointer; color: var(--text-muted); font-size: 13px; padding: 4px 0; }
  details[open] { display: flex; flex-direction: column; gap: 6px; }
  .hint { margin: 0; color: var(--text-muted); font-size: 12px; }
  .err { margin: 0; color: var(--error); font-size: 13px; }
  .actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .grow { flex: 1; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 7px 14px; cursor: pointer; font: inherit; font-size: 14px;
  }
  .primary { border-color: var(--accent); color: var(--accent); }
  .primary:disabled { opacity: 0.4; cursor: default; }
  .ghost { background: none; border-color: transparent; color: var(--text-muted); }
  .ghost:hover { color: var(--error); }
  .danger { color: var(--error); border-color: var(--error); }
</style>
