<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import CategoryIcon from "../components/CategoryIcon.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { app } from "../lib/app.svelte";
  import { addDays, formatDay, today } from "../lib/dates";
  import { formatTime } from "../lib/clock";
  import { formatEntryData } from "../lib/format";
  import { listEntriesBetween, type RecentEntry } from "../lib/db/entries";
  import { AW_DOWNLOAD_URL, loadAwDay, type AwDay } from "../lib/activity/activitywatch";
  import { timelineBlocks, totalSeconds, totalsByApp } from "../lib/activity/aggregate";
  import { buildTimeline, formatSeconds } from "../lib/activity/timeline";

  let day = $state(today());
  let aw = $state<AwDay | null>(null);
  let entries = $state<RecentEntry[]>([]);
  let loading = $state(false);
  let openApp = $state<string | null>(null);

  async function load(d: string) {
    loading = true;
    const [y, m, dd] = d.split("-").map(Number);
    const from = new Date(y, m - 1, dd);
    const to = new Date(y, m - 1, dd + 1);
    const [awDay, list] = await Promise.all([
      loadAwDay(from, to),
      listEntriesBetween(from.toISOString(), to.toISOString()).catch(() => []),
    ]);
    if (d !== day) return; // the user changed day meanwhile
    aw = awDay;
    entries = list;
    loading = false;
  }

  // Reload when the day changes, or when new entries arrive (GitHub sync, saves).
  $effect(() => { app.recent; load(day); });

  const spans = $derived(aw?.ok ? aw.spans : []);
  const totals = $derived(totalsByApp(spans));
  const total = $derived(totalSeconds(spans));
  const maxApp = $derived(totals[0]?.seconds ?? 1);
  const timeline = $derived(buildTimeline(entries, timelineBlocks(spans)));
  const byId = $derived(new Map(app.categories.map((c) => [c.id, c])));
  const entryById = $derived(new Map(entries.map((e) => [e.id, e])));
  const isToday = $derived(day === today());
</script>

<section class="glass">
  <div class="daynav">
    <button onclick={() => (day = addDays(day, -1))} aria-label="Jour précédent"><Icon name="chevron-left" /></button>
    <h2>{formatDay(day)}</h2>
    <button onclick={() => (day = addDays(day, 1))} disabled={isToday} aria-label="Jour suivant"><Icon name="chevron-right" /></button>
  </div>

  {#if aw && !aw.ok}
    <div class="notice">
      <p>{aw.reason}</p>
      <p class="muted">Le temps par application vient d'ActivityWatch, un logiciel libre qui tourne en local. Les saisies et les pushs GitHub restent visibles ci-dessous.</p>
      <button class="link" onclick={() => openUrl(AW_DOWNLOAD_URL)}>Installer ActivityWatch <Icon name="external-link" size={13} /></button>
    </div>
  {/if}

  <div class="grid">
    <div>
      <h3>Temps actif {#if aw?.ok}<span class="accent">{formatSeconds(total)}</span>{/if}</h3>
      {#if aw?.ok && !aw.hasAfk}<p class="muted small">Pas de détection d'inactivité : tout le temps de fenêtre est compté.</p>{/if}
      {#if aw?.ok && totals.length === 0}<p class="muted">Aucune activité enregistrée ce jour-là.</p>{/if}
      <ul class="apps">
        {#each totals.slice(0, 10) as t (t.app)}
          <li>
            <button class="app" onclick={() => (openApp = openApp === t.app ? null : t.app)}>
              <span class="name">{t.app}</span>
              <span class="bar"><span style:width="{(t.seconds / maxApp) * 100}%"></span></span>
              <span class="dur">{formatSeconds(t.seconds)}</span>
            </button>
            {#if openApp === t.app}
              <ul class="titles">
                {#each t.titles as ti (ti.title)}
                  <li><span>{ti.title}</span><span class="dur">{formatSeconds(ti.seconds)}</span></li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    </div>

    <div>
      <h3>Fil de la journée</h3>
      {#if loading && timeline.length === 0}<p class="muted">Chargement…</p>
      {:else if timeline.length === 0}<p class="muted">Rien pour ce jour.</p>{/if}
      <ol class="timeline">
        {#each timeline as item (item.kind === "entry" ? item.entryId : `${item.app}-${item.at}`)}
          {#if item.kind === "entry"}
            {@const e = entryById.get(item.entryId)}
            {@const cat = byId.get(item.categoryId)}
            <li class="entry">
              <span class="time">{formatTime(new Date(item.at))}</span>
              <CategoryIcon icon={cat?.icon} color={cat?.color} />
              <span><strong>{cat?.name ?? "?"}</strong>
                {#if cat && e}<span class="muted"> {formatEntryData(cat, e.data)}</span>{/if}
                {#if item.source !== "manual"}<span class="src">{item.source === "ai" ? "IA" : item.source}</span>{/if}
              </span>
            </li>
          {:else}
            <li class="activity">
              <span class="time">{formatTime(new Date(item.at))}</span>
              <span class="line"></span>
              <span class="muted">{item.app} · {formatSeconds(item.seconds)}</span>
            </li>
          {/if}
        {/each}
      </ol>
    </div>
  </div>
</section>

<style>
  section { max-width: 1200px; width: 100%; margin: 0 auto; height: 100%; overflow: auto; padding: 4px 24px 24px; border-radius: var(--radius); }
  .daynav { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .daynav h2 { margin: 0; font-weight: 400; font-size: 20px; min-width: 180px; text-align: center; }
  .daynav button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; width: 36px; height: 32px; cursor: pointer;
  }
  .daynav button:disabled { opacity: 0.3; cursor: default; }
  .notice { margin: 20px auto 0; max-width: 760px; padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .notice p { margin: 4px 0; }
  .link { background: none; border: none; color: var(--accent); padding: 0; cursor: pointer; font: inherit; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 32px; margin-top: 20px; }
  h3 { font-size: 13px; font-weight: 600; color: var(--text-muted); }
  .accent { color: var(--accent); margin-left: 6px; }
  .muted { color: var(--text-muted); }
  .small { font-size: 12px; }
  ul, ol { list-style: none; margin: 0; padding: 0; }
  .apps > li { margin-bottom: 4px; }
  .app {
    width: 100%; display: grid; grid-template-columns: 130px 1fr 64px; gap: 10px; align-items: center;
    background: none; border: none; color: var(--text); padding: 6px 4px; cursor: pointer; font: inherit; text-align: left;
    border-radius: 6px;
  }
  .app:hover { background: var(--surface); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
  .dur { color: var(--text-muted); font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; }
  .titles { margin: 2px 0 8px 14px; font-size: 13px; }
  .titles li { display: flex; justify-content: space-between; gap: 10px; padding: 2px 4px; color: var(--text-muted); }
  .titles li span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .timeline li { display: grid; grid-template-columns: 48px 12px 1fr; gap: 10px; align-items: center; padding: 5px 0; }
  .time { color: var(--text-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .line { width: 2px; height: 18px; background: var(--border); margin-left: 4px; }
  .activity { font-size: 13px; }
  .src { margin-left: 6px; font-size: 11px; padding: 1px 6px; border-radius: 999px; background: var(--surface-strong); color: var(--text-muted); }
</style>
