<script lang="ts">
  import { onDestroy } from "svelte";
  import { formatDate, formatTime } from "../lib/clock";

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));
</script>

<header>
  <div class="time">{formatTime(now)}</div>
  <div class="date">{formatDate(now)}</div>
</header>

<section class="placeholder">
  Tâches, dernières entrées, activité et séries arrivent aux jalons suivants.
</section>

<style>
  header { text-align: center; }
  .time { font-size: 72px; font-weight: 200; letter-spacing: 2px; }
  .date { color: var(--text-muted); font-size: 18px; }
  .placeholder {
    margin-top: 48px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
