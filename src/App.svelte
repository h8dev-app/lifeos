<script lang="ts">
  import { onMount } from "svelte";
  import CommandBar from "./components/CommandBar.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import { hideOverlay, onOverlayShown } from "./lib/overlay";

  let bar: CommandBar;
  let lastInput = $state("");

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideOverlay();
    }
  }

  onMount(() => {
    bar.focus();
    // Rust emits this each time the overlay appears: focus the bar again.
    const unlisten = onOverlayShown(() => bar.focus());
    // Fallback: some compositors give focus later than the "shown" event.
    const onFocus = () => bar.focus();
    window.addEventListener("focus", onFocus);
    return () => {
      unlisten.then((f) => f());
      window.removeEventListener("focus", onFocus);
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <div class="content"><Dashboard /></div>
  <footer>
    {#if lastInput}<p class="echo">Reçu : {lastInput} (parsing au jalon 2)</p>{/if}
    <CommandBar bind:this={bar} onsubmit={(t) => (lastInput = t)} />
    <p class="hint">Échap pour fermer</p>
  </footer>
</main>

<style>
  main {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--overlay-bg);
    padding: 64px 24px 40px;
  }
  .content { flex: 1; overflow: auto; }
  footer { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .hint, .echo { margin: 0; color: var(--text-muted); font-size: 13px; }
</style>
