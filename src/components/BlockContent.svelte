<script lang="ts">
  import { onDestroy } from "svelte";
  import { formatDate, formatTime } from "../lib/clock";
  import RecentEntries from "./RecentEntries.svelte";
  import TaskList from "./TaskList.svelte";
  import Streaks from "./Streaks.svelte";
  import ActivitySummary from "./ActivitySummary.svelte";
  import AgendaToday from "./AgendaToday.svelte";
  import { app, guard, reloadEntries, say } from "../lib/app.svelte";
  import { deleteEntry } from "../lib/db/entries";
  import { startOfDayIso, today } from "../lib/dates";
  import type { WidgetId } from "../lib/dashboard/layout";

  // Content of one home block, also shown alone in a screen widget.
  // The parent must be a size container (container-type: size) for the clock.
  let { id }: { id: WidgetId } = $props();

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));

  // Today's open tasks (carried over ones included), then those done today.
  const todayTasks = $derived(
    app.tasks
      .filter((t) => (t.doneAt ? t.doneAt >= startOfDayIso(now) : !t.plannedFor || t.plannedFor <= today(now)))
      .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || a.priority - b.priority),
  );

  async function remove(entryId: string) {
    await guard(async () => {
      await deleteEntry(entryId);
      await reloadEntries();
      say("Entrée supprimée.");
    });
  }
</script>

{#if id === "clock"}
  <div class="clock">
    <div class="time">{formatTime(now)}</div>
    <div class="date">{formatDate(now)}</div>
  </div>
{:else if id === "streaks"}
  <h2>Séries</h2>
  {#if app.streaks.length}<Streaks />{:else}<p class="empty">Aucune série. Enregistre une entrée deux jours de suite.</p>{/if}
{:else if id === "agenda"}
  <AgendaToday />
{:else if id === "tasks"}
  <h2><button class="title" onclick={() => (app.view = "tasks")}>Tâches du jour</button></h2>
  {#if todayTasks.length}
    <TaskList tasks={todayTasks} compact />
  {:else}
    <p class="empty">Aucune tâche. <code>/tache …</code></p>
  {/if}
{:else if id === "recent"}
  <RecentEntries entries={app.recent} categories={app.categories} ondelete={remove} />
{:else if id === "activity"}
  <ActivitySummary />
{/if}

<style>
  .clock { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .time { font-size: clamp(24px, min(40cqh, 18cqw), 96px); font-weight: 200; letter-spacing: 2px; line-height: 1.1; }
  .date { color: var(--text-muted); font-size: clamp(12px, 10cqh, 18px); }
  h2 { font-size: 13px; font-weight: 600; color: var(--text-muted); margin: 12px 0; }
  .title { background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer; }
  .title:hover { color: var(--text); }
  .empty { color: var(--text-muted); }
  code { font-family: var(--mono); color: var(--text); }
</style>
