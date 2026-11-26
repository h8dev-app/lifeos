<script lang="ts">
  import Icon from "./Icon.svelte";
  import { app, guard } from "../lib/app.svelte";
  import { listEvents } from "../lib/db/events";
  import { formatMinutes, minutesOf, type AgendaEvent } from "../lib/agenda/agenda";
  import { addDays, today } from "../lib/dates";

  // Today's appointments and memos (+ tomorrow's, so the evening shows what's next).
  let items = $state<AgendaEvent[]>([]);
  const t = $derived(today());

  $effect(() => {
    app.agendaVersion;
    guard(() => listEvents(t, addDays(t, 1))).then((list) => (items = list ?? []));
  });

  const todayItems = $derived(items.filter((e) => e.day === t));
  const tomorrow = $derived(items.filter((e) => e.day !== t));
  const label = (e: AgendaEvent) => (e.startAt ? formatMinutes(minutesOf(e.startAt)) : "Journée");
</script>

<section>
  <h2><button class="title" onclick={() => (app.view = "agenda")}>Agenda</button></h2>
  {#if todayItems.length === 0}
    <p class="muted">Rien aujourd'hui. <code>/rdv …</code> ou <code>/memo …</code></p>
  {:else}
    <ul>
      {#each todayItems as e (e.id)}
        <li class={e.kind}>
          <span class="when">{label(e)}</span>
          <span class="what"><Icon name={e.kind === "memo" ? "pin" : "calendar"} size={14} /> {e.title}</span>
          {#if e.location}<span class="loc">{e.location}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if tomorrow.length}
    <p class="muted small">Demain : {tomorrow.map((e) => `${e.startAt ? formatMinutes(minutesOf(e.startAt)) + " " : ""}${e.title}`).join(" · ")}</p>
  {/if}
</section>

<style>
  section { min-width: 0; }
  h2 { font-size: 13px; font-weight: 600; color: var(--text-muted); }
  .title { background: none; border: none; padding: 0; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; cursor: pointer; }
  .title:hover { color: var(--text); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li {
    display: grid; grid-template-columns: 64px 1fr; gap: 2px 10px; align-items: center;
    padding: 8px 12px; background: var(--surface); border-radius: 8px; border-left: 3px solid var(--accent);
  }
  li.memo { border-left-color: var(--warn); }
  .when { color: var(--text-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .what { display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loc { grid-column: 2; color: var(--text-muted); font-size: 12px; }
  .muted { color: var(--text-muted); }
  .small { font-size: 12px; margin-top: 8px; }
  code { font-family: var(--mono); color: var(--text); }
</style>
