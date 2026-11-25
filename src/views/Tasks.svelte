<script lang="ts">
  import TaskList from "../components/TaskList.svelte";
  import { app } from "../lib/app.svelte";
  import { today } from "../lib/dates";

  const t = $derived(today());
  const open = $derived(app.tasks.filter((x) => !x.doneAt));
  const now = $derived(open.filter((x) => !x.plannedFor || x.plannedFor <= t));
  const later = $derived(open.filter((x) => x.plannedFor && x.plannedFor > t));
  const done = $derived(app.tasks.filter((x) => x.doneAt));
</script>

<section>
  <h2>Aujourd'hui <span class="count">{now.length}</span></h2>
  {#if now.length}<TaskList tasks={now} />{:else}<p class="empty">Rien à faire. Ajoute avec <code>/tache réviser BTS @vendredi</code>.</p>{/if}

  {#if later.length}
    <h2>Plus tard</h2>
    <TaskList tasks={later} />
  {/if}

  {#if done.length}
    <h2>Faites aujourd'hui <span class="count">{done.length}</span></h2>
    <TaskList tasks={done} />
  {/if}
</section>

<style>
  section { width: min(760px, 100%); margin: 0 auto; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin: 24px 0 10px; }
  .count { color: var(--accent); margin-left: 6px; }
  .empty { color: var(--text-muted); }
  code { font-family: var(--mono); color: var(--text); }
</style>
