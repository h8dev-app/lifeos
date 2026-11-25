<script lang="ts">
  import { app, type View } from "../lib/app.svelte";

  const TABS: { view: View; label: string }[] = [
    { view: "dashboard", label: "Accueil" },
    { view: "tasks", label: "Tâches" },
    { view: "notes", label: "Notes" },
    { view: "activity", label: "Activité" },
    { view: "settings", label: "Réglages" },
  ];
</script>

<nav>
  {#each TABS as tab, i (tab.view)}
    <button class:active={app.view === tab.view} onclick={() => (app.view = tab.view)} title="Ctrl+{i + 1}">
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  nav { display: flex; justify-content: center; gap: 4px; margin-bottom: 24px; }
  button {
    background: none; border: 1px solid transparent; border-radius: 999px;
    color: var(--text-muted); padding: 5px 14px; cursor: pointer; font: inherit; font-size: 14px;
  }
  button:hover { color: var(--text); }
  .active { color: var(--text); background: var(--surface); border-color: var(--border); }
</style>
