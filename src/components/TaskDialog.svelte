<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "../lib/app.svelte";
  import type { Task } from "../lib/db/tasks";
  import { PRIORITIES, STATUSES, type Priority, type TaskStatus } from "../lib/tasks/board";
  import Select from "./Select.svelte";

  // Create or edit a task. `task` null = creation.
  export interface TaskForm {
    title: string;
    status: TaskStatus;
    priority: Priority;
    categoryId: string | null;
    newCategory: string;
    dueDate: string | null;
  }

  let {
    task = null, defaultStatus = "todo", defaultCategoryId = null, onsave, ondelete, oncancel,
  }: {
    task?: Task | null;
    defaultStatus?: TaskStatus;
    defaultCategoryId?: string | null;
    onsave: (f: TaskForm) => void;
    ondelete?: () => void;
    oncancel: () => void;
  } = $props();

  const NEW = "__new__";
  // Initial values only: the dialog is created fresh each time.
  // svelte-ignore state_referenced_locally
  let title = $state(task?.title ?? "");
  // svelte-ignore state_referenced_locally
  let status = $state<TaskStatus>(task?.status ?? defaultStatus);
  // svelte-ignore state_referenced_locally
  let priority = $state<Priority>(task?.priority ?? 2);
  // svelte-ignore state_referenced_locally
  let category = $state<string>(task?.categoryId ?? defaultCategoryId ?? "");
  let newCategory = $state("");
  // svelte-ignore state_referenced_locally
  let dueDate = $state(task?.dueDate ?? "");
  let confirmDelete = $state(false);
  let input: HTMLInputElement;

  onMount(() => input.focus());

  const valid = $derived(title.trim().length > 0 && (category !== NEW || newCategory.trim().length > 0));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    onsave({
      title: title.trim(), status, priority,
      categoryId: category === NEW || category === "" ? null : category,
      newCategory: category === NEW ? newCategory.trim() : "",
      dueDate: dueDate || null,
    });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); oncancel(); }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={oncancel} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="td-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <form onsubmit={submit}>
      <h2 id="td-title">{task ? "Modifier la tâche" : "Nouvelle tâche"}</h2>

      <input class="name" bind:this={input} bind:value={title} placeholder="Que faut-il faire ?" aria-label="Titre" autocomplete="off" />

      <span class="label">Priorité</span>
      <div class="seg" role="radiogroup" aria-label="Priorité">
        {#each PRIORITIES as p (p.id)}
          <button type="button" role="radio" aria-checked={priority === p.id} class:on={priority === p.id} onclick={() => (priority = p.id)}>
            {p.dot} {p.label}
          </button>
        {/each}
      </div>

      <div class="row">
        <div class="field">
          <span class="label">Statut</span>
          <Select label="Statut" value={status} onchange={(v) => (status = v as TaskStatus)}
            options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
        <label>
          <span class="label">Échéance</span>
          <input type="date" bind:value={dueDate} />
        </label>
      </div>

      <div class="field">
        <span class="label">Catégorie</span>
        <Select label="Catégorie" bind:value={category} options={[
          { value: "", label: "Sans catégorie" },
          ...app.taskCategories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
          { value: NEW, label: "+ Nouvelle catégorie…" },
        ]} />
      </div>
      {#if category === NEW}
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={newCategory} placeholder="Nom (ex. Cours)" aria-label="Nouvelle catégorie" autofocus />
      {/if}

      <div class="actions">
        {#if task && ondelete}
          {#if confirmDelete}
            <button type="button" class="danger" onclick={ondelete}>Confirmer la suppression</button>
          {:else}
            <button type="button" class="ghost" onclick={() => (confirmDelete = true)}>🗑 Supprimer</button>
          {/if}
        {/if}
        <span class="grow"></span>
        <button type="button" onclick={oncancel}>Annuler</button>
        <button type="submit" class="primary" disabled={!valid}>{task ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 10; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: flex-start; justify-content: center; padding-top: 14vh;
  }
  .dialog {
    width: min(480px, calc(100% - 32px)); background: #161a24; border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  form { display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0 0 4px; font-size: 17px; font-weight: 600; }
  .label { display: block; color: var(--text-muted); font-size: 13px; margin: 4px 0 4px; }
  label, .field { display: flex; flex-direction: column; flex: 1; }
  .field :global(.select) { display: flex; }
  .field :global(.trigger) { padding: 9px 11px; }
  .row { display: flex; gap: 10px; }
  input {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; color: var(--text); font: inherit; outline: none; color-scheme: dark;
  }
  .name { font-size: 16px; }
  input:focus { border-color: var(--accent); }
  .seg { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button { flex: 1; border: none; border-radius: 0; background: transparent; color: var(--text-muted); padding: 7px; }
  .seg button.on { background: var(--surface-strong); color: var(--text); }
  .actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
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
