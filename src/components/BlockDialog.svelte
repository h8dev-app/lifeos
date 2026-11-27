<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import Select from "./Select.svelte";
  import { app, guard } from "../lib/app.svelte";
  import { listNotes, type NoteMeta } from "../lib/db/notes";
  import { BLOCK_TYPES, type Block } from "../lib/dashboard/layout";

  // Settings of one home block: its title and what it shows.
  let { block, onsave, ondelete, oncancel }: {
    block: Block;
    onsave: (b: Block) => void;
    /** Absent in a screen widget (blocks are deleted from the home screen). */
    ondelete?: () => void;
    oncancel: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const src = block;
  const def = BLOCK_TYPES[src.type];
  let title = $state(src.title ?? "");
  let opts = $state({ ...src.options });
  let notes = $state<NoteMeta[]>([]);
  let confirmDelete = $state(false);
  let input: HTMLInputElement;

  onMount(() => {
    input.focus();
    if (src.type === "note") guard(() => listNotes()).then((l) => (notes = l ?? []));
  });

  const s = (k: string) => (typeof opts[k] === "string" ? (opts[k] as string) : "");
  const set = (k: string) => (v: string) => (opts = { ...opts, [k]: v });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onsave({ ...src, title: title.trim() || null, options: opts });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); oncancel(); }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={oncancel} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog glass-strong" role="dialog" aria-modal="true" aria-labelledby="bd-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <form onsubmit={submit}>
      <h2 id="bd-title"><Icon name={def.icon} size={18} /> {def.label}</h2>
      <p class="desc">{def.desc}</p>

      <label class="field">
        <span class="label">Nom du bloc</span>
        <input bind:this={input} bind:value={title} placeholder={def.label} maxlength="60" autocomplete="off" />
      </label>

      {#if src.type === "clock"}
        <label class="check"><input type="checkbox" checked={opts.seconds === true} onchange={(e) => (opts = { ...opts, seconds: e.currentTarget.checked })} /> Afficher les secondes</label>
      {:else if src.type === "agenda"}
        <div class="field"><span class="label">Période</span>
          <Select label="Période" value={s("range") || "today"} onchange={set("range")} options={[
            { value: "today", label: "Aujourd'hui (et un aperçu de demain)" },
            { value: "3days", label: "Les 3 prochains jours" },
            { value: "week", label: "Les 7 prochains jours" },
          ]} />
        </div>
      {:else if src.type === "tasks"}
        <div class="field"><span class="label">Quelles tâches</span>
          <Select label="Quelles tâches" value={s("scope") || "today"} onchange={set("scope")} options={[
            { value: "today", label: "Du jour (prévues aujourd'hui ou avant)" },
            { value: "open", label: "Toutes celles à faire" },
            { value: "overdue", label: "En retard (échéance dépassée)" },
          ]} />
        </div>
        <div class="row">
          <div class="field"><span class="label">Projet</span>
            <Select label="Projet" value={s("project")} onchange={set("project")} options={[
              { value: "", label: "Tous" },
              ...app.projects.map((p) => ({ value: p.id, label: p.name, color: p.color })),
            ]} />
          </div>
          <div class="field"><span class="label">Catégorie</span>
            <Select label="Catégorie" value={s("category")} onchange={set("category")} options={[
              { value: "", label: "Toutes" },
              ...app.taskCategories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
            ]} />
          </div>
        </div>
      {:else if src.type === "project"}
        <div class="field"><span class="label">Projet</span>
          <Select label="Projet" value={s("project")} onchange={set("project")} options={[
            { value: "", label: "Choisir…" },
            ...app.projects.map((p) => ({ value: p.id, label: p.name, color: p.color })),
          ]} />
        </div>
        {#if app.projects.length === 0}<p class="hint">Aucun projet : crée-en un dans l'onglet Projets.</p>{/if}
      {:else if src.type === "notes"}
        <div class="field"><span class="label">Dossier</span>
          <Select label="Dossier" value={s("folder")} onchange={set("folder")} options={[
            { value: "", label: "Toutes les notes" },
            ...app.noteFolders.map((f) => ({ value: f, label: f })),
          ]} />
        </div>
      {:else if src.type === "note"}
        <div class="field"><span class="label">Note</span>
          <Select label="Note" value={s("note")} onchange={set("note")} options={[
            { value: "", label: notes.length ? "Choisir…" : "Chargement…" },
            ...notes.map((n) => ({ value: n.id, label: n.folder ? `${n.title} · ${n.folder}` : n.title })),
          ]} />
        </div>
      {:else if src.type === "memo"}
        <label class="field"><span class="label">Texte</span>
          <textarea rows="5" value={s("text")} oninput={(e) => set("text")(e.currentTarget.value)}></textarea>
        </label>
        <p class="hint">Tu peux aussi écrire directement dans le bloc.</p>
      {:else if src.type === "stats"}
        <div class="field"><span class="label">Période</span>
          <Select label="Période" value={s("period") || "week"} onchange={set("period")} options={[
            { value: "week", label: "Les 7 derniers jours" },
            { value: "month", label: "Les 30 derniers jours" },
          ]} />
        </div>
      {:else if src.type === "entries"}
        <div class="field"><span class="label">Habitude</span>
          <Select label="Habitude" value={s("category")} onchange={set("category")} options={[
            { value: "", label: "Toutes" },
            ...app.categories.map((c) => ({ value: c.id, label: c.name, color: c.color ?? undefined })),
          ]} />
        </div>
      {/if}

      <div class="field"><span class="label">Opacité une fois épinglé sur l'écran</span>
        <Select label="Opacité du widget" value={s("screenOpacity")} onchange={set("screenOpacity")} options={[
          { value: "", label: "Comme les panneaux (Réglages → Apparence)" },
          { value: "1", label: "100 % (opaque)" },
          { value: "0.85", label: "85 %" },
          { value: "0.7", label: "70 %" },
          { value: "0.55", label: "55 %" },
          { value: "0.4", label: "40 % (très transparent)" },
        ]} />
      </div>

      <div class="actions">
        {#if ondelete}
          {#if confirmDelete}
            <button type="button" class="danger" onclick={ondelete}>Confirmer la suppression</button>
          {:else}
            <button type="button" class="ghost" onclick={() => (confirmDelete = true)}><Icon name="trash-2" size={14} /> Supprimer le bloc</button>
          {/if}
        {/if}
        <span class="grow"></span>
        <button type="button" onclick={oncancel}>Annuler</button>
        <button type="submit" class="primary">Enregistrer</button>
      </div>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 10; background: var(--backdrop);
    display: flex; align-items: flex-start; justify-content: center; padding-top: 10vh;
  }
  .dialog { width: min(480px, calc(100% - 32px)); border-radius: var(--radius); padding: 20px; max-height: 85vh; overflow: auto; }
  form { display: flex; flex-direction: column; gap: 8px; }
  h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; }
  .desc { margin: 0 0 6px; color: var(--text-muted); font-size: 13px; }
  .label { display: block; color: var(--text-muted); font-size: 13px; margin: 4px 0; }
  .field { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .field :global(.select) { display: flex; }
  .field :global(.trigger) { padding: 9px 11px; }
  .row { display: flex; gap: 10px; }
  .check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .check input { accent-color: var(--accent); }
  input:not([type="checkbox"]), textarea {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; color: var(--text); font: inherit; outline: none; resize: vertical;
  }
  input:focus, textarea:focus { border-color: var(--accent); }
  .hint { margin: 0; color: var(--text-muted); font-size: 12px; }
  .actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .grow { flex: 1; }
  button {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 7px 14px; cursor: pointer; font: inherit; font-size: 14px;
  }
  .primary { border-color: var(--accent); color: var(--accent); }
  .ghost { background: none; border-color: transparent; color: var(--text-muted); }
  .ghost:hover { color: var(--error); }
  .danger { color: var(--error); border-color: var(--error); }
</style>
