<script lang="ts">
  import { onDestroy } from "svelte";
  import { formatDate, formatTime } from "../lib/clock";
  import RecentEntries from "../components/RecentEntries.svelte";
  import TaskList from "../components/TaskList.svelte";
  import { app, guard, reloadEntries, say } from "../lib/app.svelte";
  import { deleteEntry } from "../lib/db/entries";
  import { today } from "../lib/dates";

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));

  // Today's open tasks (carried over ones included), then those done today.
  const todayTasks = $derived(
    app.tasks.filter((t) => t.doneAt || !t.plannedFor || t.plannedFor <= today(now)),
  );

  async function remove(id: string) {
    await guard(async () => {
      await deleteEntry(id);
      await reloadEntries();
      say("Entrée supprimée.");
    });
  }
</script>

<header>
  <div class="time">{formatTime(now)}</div>
  <div class="date">{formatDate(now)}</div>
</header>

<div class="grid">
  <section>
    <h2>Tâches du jour</h2>
    {#if todayTasks.length}
      <TaskList tasks={todayTasks} compact />
    {:else}
      <p class="empty">Aucune tâche. <code>/tache …</code></p>
    {/if}
  </section>
  <RecentEntries entries={app.recent} categories={app.categories} ondelete={remove} />
</div>

<style>
  header { text-align: center; margin-bottom: 32px; }
  .time { font-size: 72px; font-weight: 200; letter-spacing: 2px; }
  .date { color: var(--text-muted); font-size: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 32px; max-width: 1200px; margin: 0 auto; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
  .empty { color: var(--text-muted); }
  code { font-family: var(--mono); color: var(--text); }
</style>
