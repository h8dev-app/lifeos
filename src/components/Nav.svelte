<script lang="ts">
  import { app, type View } from "../lib/app.svelte";
  import Icon from "./Icon.svelte";
  import type { IconName } from "../lib/ui/iconNames";

  const TABS: { view: View; label: string; icon: IconName }[] = [
    { view: "dashboard", label: "Accueil", icon: "house" },
    { view: "tasks", label: "Tâches", icon: "list-checks" },
    { view: "agenda", label: "Agenda", icon: "calendar" },
    { view: "notes", label: "Notes", icon: "notebook-pen" },
    { view: "activity", label: "Activité", icon: "activity" },
    { view: "claude", label: "Claude", icon: "square-terminal" },
    { view: "settings", label: "Réglages", icon: "settings" },
  ];

  // Sliding pill under the active tab: measured from the button itself.
  let buttons: HTMLButtonElement[] = $state([]);
  let pill = $state({ left: 0, width: 0 });
  let ready = $state(false); // no slide on the first placement

  function measure() {
    const b = buttons[TABS.findIndex((t) => t.view === app.view)];
    if (b) pill = { left: b.offsetLeft, width: b.offsetWidth };
  }

  $effect(() => {
    void app.view;
    measure();
    if (!ready) requestAnimationFrame(() => (ready = true));
  });
</script>

<svelte:window onresize={measure} />

<nav class="glass">
  <span class="pill" class:ready style:transform="translateX({pill.left}px)" style:width="{pill.width}px"></span>
  {#each TABS as tab, i (tab.view)}
    <button bind:this={buttons[i]} class:active={app.view === tab.view} onclick={() => (app.view = tab.view)} title="Ctrl+{i + 1}">
      <Icon name={tab.icon} size={15} />
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: relative; display: flex; justify-content: center; gap: 2px; margin: 0 auto 16px; flex-shrink: 0;
    padding: 5px; border-radius: 999px;
  }
  .pill {
    position: absolute; top: 5px; bottom: 5px; left: 0; border-radius: 999px;
    background: var(--surface-strong); box-shadow: var(--pill-shadow, none);
  }
  .pill.ready { transition: transform 320ms var(--ease-spring), width 320ms var(--ease-spring); }
  button {
    position: relative; display: flex; align-items: center; gap: 7px;
    background: none; border: none; border-radius: 999px;
    color: var(--text-muted); padding: 6px 14px; cursor: pointer; font: inherit; font-size: 14px;
    transition: color 160ms ease;
  }
  button:hover { color: var(--text); }
  .active { color: var(--text); }
  .active :global(.icon) { color: var(--accent); }
</style>
