<script lang="ts">
  import { onMount } from "svelte";
  import Select from "./Select.svelte";
  import {
    atMinutes, defaultReminder, formatMinutes, minutesOf, REMINDER_CHOICES, type AgendaEvent, type EventKind,
  } from "../lib/agenda/agenda";
  import type { EventInput } from "../lib/db/events";

  // Create or edit an appointment / memo. `event` null = creation with `initial`.
  let {
    event = null, initial, onsave, ondelete, onnote, oncancel,
  }: {
    event?: AgendaEvent | null;
    initial: { kind: EventKind; day: string; start: number | null; end: number | null };
    onsave: (e: EventInput) => void;
    ondelete?: () => void;
    /** Create (if none) and open the linked note. */
    onnote?: () => void;
    oncancel: () => void;
  } = $props();

  // Initial values only: the dialog is created fresh each time.
  // svelte-ignore state_referenced_locally
  const src = event;
  // svelte-ignore state_referenced_locally
  const init = initial;
  let kind = $state<EventKind>(src?.kind ?? init.kind);
  let title = $state(src?.title ?? "");
  let day = $state(src?.day ?? init.day);
  let allDay = $state(src ? src.allDay : init.start === null);
  let start = $state(formatMinutes(src?.startAt ? minutesOf(src.startAt) : (init.start ?? 9 * 60)));
  let end = $state(formatMinutes(src?.endAt ? minutesOf(src.endAt) : (init.end ?? (init.start ?? 9 * 60) + 60)));
  let location = $state(src?.location ?? "");
  let description = $state(src?.description ?? "");
  let remind = $state(String(src ? src.remindMinutes : defaultReminder(init.kind)));
  let confirmDelete = $state(false);
  let input: HTMLInputElement;

  onMount(() => input.focus());

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const startMin = $derived(toMin(start));
  const endMin = $derived(toMin(end));
  const timeError = $derived(
    allDay ? "" : startMin === null ? "Heure de début invalide."
    : kind === "event" && (endMin === null || endMin <= startMin) ? "La fin doit être après le début." : "",
  );
  const valid = $derived(title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day) && !timeError);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    const timed = !allDay && startMin !== null;
    onsave({
      title: title.trim(),
      kind,
      day,
      allDay: !timed,
      startAt: timed ? atMinutes(day, startMin!) : null,
      endAt: timed && kind === "event" && endMin !== null ? atMinutes(day, endMin) : null,
      location: kind === "event" && location.trim() ? location.trim() : null,
      description: description.trim() || null,
      remindMinutes: remind === "null" ? null : Number(remind),
      noteId: src?.noteId ?? null,
    });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); oncancel(); }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={oncancel} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="ev-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <form onsubmit={submit}>
      <div class="seg" role="radiogroup" aria-label="Type">
        <button type="button" role="radio" aria-checked={kind === "event"} class:on={kind === "event"} onclick={() => (kind = "event")}>📅 Rendez-vous</button>
        <button type="button" role="radio" aria-checked={kind === "memo"} class:on={kind === "memo"} onclick={() => (kind = "memo")}>📌 Pense-bête</button>
      </div>
      <h2 id="ev-title" class="sr">{event ? "Modifier" : "Nouveau"}</h2>

      <input class="name" bind:this={input} bind:value={title} autocomplete="off" aria-label="Titre"
        placeholder={kind === "event" ? "Dentiste, réunion, cours…" : "Payer le loyer, appeler…"} />

      <div class="row">
        <div class="field"><span class="label">Date</span><input type="date" bind:value={day} /></div>
        <label class="check"><input type="checkbox" bind:checked={allDay} /> Toute la journée</label>
      </div>
      {#if !allDay}
        <div class="row">
          <div class="field"><span class="label">{kind === "event" ? "Début" : "Heure"}</span><input type="time" bind:value={start} /></div>
          {#if kind === "event"}
            <div class="field"><span class="label">Fin</span><input type="time" bind:value={end} /></div>
          {/if}
        </div>
      {/if}
      {#if timeError}<p class="err">{timeError}</p>{/if}

      {#if kind === "event"}
        <div class="field"><span class="label">Lieu</span><input bind:value={location} placeholder="Optionnel" /></div>
      {/if}
      <div class="field"><span class="label">Détails</span>
        <textarea bind:value={description} rows="2" placeholder="Optionnel"></textarea></div>

      <div class="field"><span class="label">Rappel (notification)</span>
        <Select label="Rappel" bind:value={remind}
          options={REMINDER_CHOICES.map((c) => ({ value: String(c.value), label: c.label }))} />
      </div>

      {#if event && onnote}
        <button type="button" class="link" onclick={onnote}>
          📝 {event.noteId ? "Ouvrir la note liée" : "Créer une note de compte rendu"}
        </button>
      {/if}

      <div class="actions">
        {#if event && ondelete}
          {#if confirmDelete}
            <button type="button" class="danger" onclick={ondelete}>Confirmer la suppression</button>
          {:else}
            <button type="button" class="ghost" onclick={() => (confirmDelete = true)}>🗑 Supprimer</button>
          {/if}
        {/if}
        <span class="grow"></span>
        <button type="button" onclick={oncancel}>Annuler</button>
        <button type="submit" class="primary" disabled={!valid}>{event ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 10; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: flex-start; justify-content: center; padding-top: 10vh;
  }
  .dialog {
    width: min(480px, calc(100% - 32px)); background: #161a24; border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-height: 85vh; overflow: auto;
  }
  form { display: flex; flex-direction: column; gap: 8px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .label { display: block; color: var(--text-muted); font-size: 13px; margin: 2px 0 4px; }
  .field { display: flex; flex-direction: column; flex: 1; }
  .field :global(.select) { display: flex; }
  .field :global(.trigger) { padding: 9px 11px; }
  .row { display: flex; gap: 10px; align-items: flex-end; }
  .check { display: flex; align-items: center; gap: 8px; padding-bottom: 10px; white-space: nowrap; cursor: pointer; }
  .check input { accent-color: var(--accent); }
  input:not([type="checkbox"]), textarea {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 9px 11px; color: var(--text); font: inherit; outline: none; color-scheme: dark; resize: vertical;
  }
  .name { font-size: 16px; }
  input:focus, textarea:focus { border-color: var(--accent); }
  .seg { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 4px; }
  .seg button { flex: 1; border: none; border-radius: 0; background: transparent; color: var(--text-muted); padding: 8px; }
  .seg button.on { background: var(--surface-strong); color: var(--text); }
  .err { margin: 0; color: var(--error); font-size: 13px; }
  .link { align-self: flex-start; background: none; border: none; color: var(--accent); padding: 4px 0; }
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
