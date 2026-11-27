<script lang="ts">
  import Icon from "./Icon.svelte";
  import CategoryIcon from "./CategoryIcon.svelte";
  import { app, guard } from "../lib/app.svelte";
  import { listTaskDoneTimes } from "../lib/db/tasks";
  import { listEntriesBetween } from "../lib/db/entries";
  import { loadAwDay } from "../lib/activity/activitywatch";
  import { totalSeconds } from "../lib/activity/aggregate";
  import { formatSeconds } from "../lib/activity/timeline";
  import { summarizeCategories, type CategoryWeek } from "../lib/review/week";
  import { compare, countByDay, periodBounds, type StatsPeriod } from "../lib/stats/period";

  // Statistics over the last 7 or 30 days, compared with the period before.
  let { period = "week" }: { period?: StatsPeriod } = $props();

  type Stats = {
    perDay: number[];
    done: number;
    prevDone: number;
    habits: CategoryWeek[];
    prevEntries: number;
    entries: number;
    screen: number | null;
    prevScreen: number | null;
  };
  let stats = $state<Stats | null>(null);

  async function load(p: StatsPeriod) {
    const b = periodBounds(p, new Date());
    const iso = (d: Date) => d.toISOString();
    const [doneTimes, prevDone, entries, prevEntries, aw, prevAw] = await Promise.all([
      listTaskDoneTimes(iso(b.from), iso(b.to)),
      listTaskDoneTimes(iso(b.prevFrom), iso(b.prevTo)),
      listEntriesBetween(iso(b.from), iso(b.to)),
      listEntriesBetween(iso(b.prevFrom), iso(b.prevTo)),
      loadAwDay(b.from, b.to).catch(() => null),
      loadAwDay(b.prevFrom, b.prevTo).catch(() => null),
    ]);
    stats = {
      perDay: countByDay(doneTimes, b.days),
      done: doneTimes.length,
      prevDone: prevDone.length,
      habits: summarizeCategories(entries, app.categories).slice(0, 4),
      entries: entries.length,
      prevEntries: prevEntries.length,
      screen: aw?.ok ? totalSeconds(aw.spans) : null,
      prevScreen: prevAw?.ok ? totalSeconds(prevAw.spans) : null,
    };
  }

  // Reload when the period changes, after new tasks/entries, and on the widgets' refresh.
  $effect(() => {
    void app.tasks;
    void app.recent;
    void app.agendaVersion;
    guard(() => load(period));
  });

  const max = $derived(stats ? Math.max(1, ...stats.perDay) : 1);
  const label = $derived(period === "month" ? "30 jours" : "7 jours");
  const hours = (sec: number) => Math.round((sec / 3600) * 10) / 10;
</script>

{#if !stats}
  <p class="muted">Calcul…</p>
{:else}
  {@const t = compare(stats.done, stats.prevDone)}
  {@const h = compare(stats.entries, stats.prevEntries)}
  <div class="kpis">
    <div class="kpi">
      <span class="k-label"><Icon name="square-check" size={13} /> Tâches faites</span>
      <span class="k-value">{stats.done}</span>
      <span class="k-delta {t.dir}" title="Par rapport aux {label} d'avant">{t.text}</span>
    </div>
    <div class="kpi">
      <span class="k-label"><Icon name="book-open" size={13} /> Saisies</span>
      <span class="k-value">{stats.entries}</span>
      <span class="k-delta {h.dir}" title="Par rapport aux {label} d'avant">{h.text}</span>
    </div>
    {#if stats.screen !== null}
      {@const s = compare(hours(stats.screen), stats.prevScreen !== null ? hours(stats.prevScreen) : hours(stats.screen))}
      <div class="kpi">
        <span class="k-label"><Icon name="activity" size={13} /> Écran</span>
        <span class="k-value">{formatSeconds(stats.screen)}</span>
        {#if stats.prevScreen !== null}<span class="k-delta {s.dir} neutral" title="Heures, par rapport aux {label} d'avant">{s.text} h</span>{/if}
      </div>
    {/if}
  </div>

  <p class="sub">Tâches faites par jour · {label}</p>
  <div class="chart" class:dense={stats.perDay.length > 10} role="img" aria-label="Tâches faites par jour">
    {#each stats.perDay as n, i (i)}
      <span class="col" title="{n} tâche{n > 1 ? 's' : ''}"><span class="fill" style:height="{(n / max) * 100}%"></span></span>
    {/each}
  </div>

  {#if stats.habits.length}
    <p class="sub">Habitudes</p>
    <ul>
      {#each stats.habits as c (c.category.id)}
        <li>
          <CategoryIcon icon={c.category.icon} color={c.category.color} size={14} />
          <span class="name">{c.category.name}</span>
          <span class="muted">{c.count}× · {c.days} j</span>
          {#if c.totals[0]}<span class="total">{c.totals[0].split(" : ")[1]}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .muted { color: var(--text-muted); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
  .kpi { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; background: var(--surface); }
  .k-label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); }
  .k-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .k-delta { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--text-muted); }
  .k-delta.up { color: var(--ok); }
  .k-delta.down { color: var(--error); }
  .k-delta.neutral { color: var(--text-muted); }
  .sub { margin: 14px 0 6px; font-size: 12px; color: var(--text-muted); }
  .chart { display: flex; align-items: flex-end; gap: 4px; height: 56px; }
  .chart.dense { gap: 2px; }
  .col { flex: 1; height: 100%; display: flex; align-items: flex-end; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .fill { display: block; width: 100%; background: var(--accent); border-radius: 4px; transition: height 400ms var(--ease); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  li { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: var(--surface); font-size: 13px; }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .total { font-variant-numeric: tabular-nums; }
</style>
