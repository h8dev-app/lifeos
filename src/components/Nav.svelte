<script lang="ts">
  import { app, type View } from "../lib/app.svelte";

  const TABS: { view: View; label: string }[] = [
    { view: "dashboard", label: "Accueil" },
    { view: "tasks", label: "Tâches" },
    { view: "agenda", label: "Agenda" },
    { view: "notes", label: "Notes" },
    { view: "activity", label: "Activité" },
    { view: "claude", label: "Claude" },
    { view: "settings", label: "Réglages" },
  ];
</script>

<nav class="glass">
  {#each TABS as tab, i (tab.view)}
    <button class:active={app.view === tab.view} onclick={() => (app.view = tab.view)} title="Ctrl+{i + 1}">
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  nav { display: flex; justify-content: center; gap: 4px; margin: 0 auto 16px; flex-shrink: 0; padding: 5px; border-radius: 999px; }
  button {
    background: none; border: 1px solid transparent; border-radius: 999px;
    color: var(--text-muted); padding: 5px 14px; cursor: pointer; font: inherit; font-size: 14px;
  }
  button:hover { color: var(--text); }
  .active { color: var(--text); background: rgba(255, 255, 255, 0.16); border-color: rgba(255, 255, 255, 0.22); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3); }
</style>
