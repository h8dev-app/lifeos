<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "../lib/app.svelte";
  import { loadAwDay, type AwDay } from "../lib/activity/activitywatch";
  import { totalSeconds, totalsByApp } from "../lib/activity/aggregate";
  import { formatSeconds } from "../lib/activity/timeline";

  // Today's active time per app (top 5). Refreshed every 5 minutes.
  let aw = $state<AwDay | null>(null);

  async function load() {
    const now = new Date();
    aw = await loadAwDay(new Date(now.getFullYear(), now.getMonth(), now.getDate()), now);
  }

  onMount(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  });

  const totals = $derived(aw?.ok ? totalsByApp(aw.spans).slice(0, 5) : []);
  const total = $derived(aw?.ok ? totalSeconds(aw.spans) : 0);
  const max = $derived(totals[0]?.seconds ?? 1);
</script>

<section>
  <h2>
    <button class="title" onclick={() => (app.view = "activity")}>Activité du jour</button>
    {#if aw?.ok}<span class="accent">{formatSeconds(total)}</span>{/if}
  </h2>
  {#if aw === null}
    <p class="muted">Chargement…</p>
  {:else if !aw.ok}
    <p class="muted">ActivityWatch indisponible. <button class="link" onclick={() => (app.view = "activity")}>Détails</button></p>
  {:else if totals.length === 0}
    <p class="muted">Rien encore aujourd'hui.</p>
  {:else}
    <ul>
      {#each totals as t (t.app)}
        <li>
          <span class="name">{t.app}</span>
          <span class="bar"><span style:width="{(t.seconds / max) * 100}%"></span></span>
          <span class="dur">{formatSeconds(t.seconds)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section { min-width: 0; }
  h2 { font-size: 13px; font-weight: 600; color: var(--text-muted); }
  .title { background: none; border: none; padding: 0; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; cursor: pointer; }
  .title:hover { color: var(--text); }
  .accent { color: var(--accent); margin-left: 6px; }
  .muted { color: var(--text-muted); }
  .link { background: none; border: none; color: var(--accent); padding: 0; cursor: pointer; font: inherit; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li { display: grid; grid-template-columns: 110px 1fr 56px; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface); border-radius: 8px; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 6px; background: var(--surface-strong); border-radius: 3px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); }
  .dur { color: var(--text-muted); font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; }
</style>
