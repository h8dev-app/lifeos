<script lang="ts">
  import Icon from "./Icon.svelte";
  import { app, guard } from "../lib/app.svelte";
  import { listEvents } from "../lib/db/events";
  import { formatMinutes, minutesOf, type AgendaEvent } from "../lib/agenda/agenda";
  import { addDays, formatDay, today } from "../lib/dates";

  // Appointments and memos. "today": today (+ a line for tomorrow);
  // "3days" / "week": the next days, grouped by day.
  let { range = "today", bare = false }: { range?: string; bare?: boolean } = $props();

  let items = $state<AgendaEvent[]>([]);
  const t = $derived(today());
  const span = $derived(range === "week" ? 6 : range === "3days" ? 2 : 1);

  $effect(() => {
    app.agendaVersion;
    guard(() => listEvents(t, addDays(t, span))).then((list) => (items = list ?? []));
  });

  const todayItems = $derived(items.filter((e) => e.day === t));
  const tomorrow = $derived(items.filter((e) => e.day !== t));
  const days = $derived(
    range === "today" ? [] : Array.from({ length: span + 1 }, (_, i) => addDays(t, i)).filter((d) => items.some((e) => e.day === d)),
  );
  const label = (e: AgendaEvent) => (e.startAt ? formatMinutes(minutesOf(e.startAt)) : "Journée");
</script>

<section>
  {#if !bare}<h2><button class="title" onclick={() => (app.view = "agenda")}>Agenda</button></h2>{/if}
  {#if range === "today"}
    {#if todayItems.length === 0}
      <p class="muted">Rien aujourd'hui. <code>/rdv …</code> ou <code>/memo …</code></p>
    {:else}
      <ul>
        {#each todayItems as e (e.id)}{@render item(e)}{/each}
      </ul>
    {/if}
    {#if tomorrow.length}
      <p class="muted small">Demain : {tomorrow.map((e) => `${e.startAt ? formatMinutes(minutesOf(e.startAt)) + " " : ""}${e.title}`).join(" · ")}</p>
    {/if}
  {:else if days.length === 0}
    <p class="muted">Rien de prévu {range === "week" ? "cette semaine" : "ces 3 jours"}.</p>
  {:else}
    {#each days as d (d)}
      <p class="day">{formatDay(d)}</p>
      <ul>
        {#each items.filter((e) => e.day === d) as e (e.id)}{@render item(e)}{/each}
      </ul>
    {/each}
  {/if}
</section>

{#snippet item(e: AgendaEvent)}
  <li class={e.kind}>
    <span class="when">{label(e)}</span>
    <span class="what"><Icon name={e.kind === "memo" ? "pin" : "calendar"} size={14} /> {e.title}</span>
    {#if e.location}<span class="loc">{e.location}</span>{/if}
  </li>
{/snippet}

<style>
  section { min-width: 0; }
  h2 { font-size: 13px; font-weight: 600; color: var(--text-muted); }
  .title { background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer; }
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
  .day { margin: 10px 0 6px; font-size: 12px; font-weight: 600; color: var(--text-muted); }
  .day:first-child { margin-top: 0; }
  code { font-family: var(--mono); color: var(--text); }
</style>
