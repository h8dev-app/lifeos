<script lang="ts">
  import { onDestroy } from "svelte";
  import { formatDate, formatTime } from "../lib/clock";
  import RecentEntries from "../components/RecentEntries.svelte";
  import type { RecentEntry } from "../lib/db/entries";
  import type { Category } from "../lib/types";

  let {
    categories,
    recent,
    ondelete,
  }: { categories: Category[]; recent: RecentEntry[]; ondelete: (id: string) => void } = $props();

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));
</script>

<header>
  <div class="time">{formatTime(now)}</div>
  <div class="date">{formatDate(now)}</div>
</header>

<RecentEntries entries={recent} {categories} {ondelete} />

<style>
  header { text-align: center; margin-bottom: 40px; }
  .time { font-size: 72px; font-weight: 200; letter-spacing: 2px; }
  .date { color: var(--text-muted); font-size: 18px; }
</style>
