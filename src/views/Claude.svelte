<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import Terminal from "../components/Terminal.svelte";
  import { app } from "../lib/app.svelte";
  import { CLAUDE_INSTALL_URL, claudeInstalled } from "../lib/pty";

  // Claude Code panel: the official CLI, interactive, typed by the user.
  let installed = $state<boolean | null>(null);
  let folder = $state(app.claude.cwd ?? "~/projets");
  let terminal: Terminal | undefined = $state();

  onMount(async () => {
    installed = await claudeInstalled().catch(() => false);
  });

  // Focus the terminal each time the panel becomes visible.
  $effect(() => {
    if (app.view === "claude" && app.claude.running) queueMicrotask(() => terminal?.focus());
  });

  function start() {
    app.claude.cwd = folder.trim() || null;
    app.claude.session++;
    app.claude.running = true;
  }

  function stop() {
    app.claude.running = false;
  }
</script>

<section>
  {#if installed === false}
    <div class="notice">
      <p><code>claude</code> n'est pas installé (ou introuvable dans le PATH).</p>
      <button class="link" onclick={() => openUrl(CLAUDE_INSTALL_URL)}>Installer Claude Code <Icon name="external-link" size={13} /></button>
    </div>
  {:else}
    <div class="bar">
      <label for="cwd">Dossier</label>
      <input id="cwd" bind:value={folder} disabled={app.claude.running} spellcheck="false"
        onkeydown={(e) => e.key === "Enter" && !app.claude.running && start()} />
      {#if app.claude.running}
        <button onclick={stop}>Fermer la session</button>
      {:else}
        <button class="primary" onclick={start} disabled={installed === null}>Lancer claude</button>
      {/if}
    </div>
    <p class="hint">Dans le terminal, <kbd>Échap</kbd> va à Claude. <kbd>Maj</kbd>+<kbd>Échap</kbd> ferme l'overlay (la session continue).</p>

    {#if app.claude.running}
      {#key app.claude.session}
        <Terminal bind:this={terminal} cwd={app.claude.cwd} onexit={() => (app.claude.running = false)} />
      {/key}
    {:else}
      <p class="empty">Aucune session. <code>/claude ~/projets/lifeos</code> ou « Lancer claude ».</p>
    {/if}
  {/if}
</section>

<style>
  section { display: flex; flex-direction: column; height: 100%; max-width: 1200px; margin: 0 auto; gap: 8px; }
  .bar { display: flex; gap: 8px; align-items: center; }
  label { color: var(--text-muted); font-size: 13px; }
  input {
    flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 7px 10px; color: var(--text); font: 14px var(--mono); outline: none;
  }
  input:focus { border-color: var(--accent); }
  input:disabled { opacity: 0.6; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 7px 14px; cursor: pointer; font: inherit; font-size: 14px;
  }
  .primary { border-color: var(--accent); color: var(--accent); }
  .link { background: none; border: none; color: var(--accent); padding: 0; }
  .hint { margin: 0; color: var(--text-muted); font-size: 12px; }
  kbd { font: 11px var(--mono); padding: 1px 5px; border: 1px solid var(--border); border-radius: 4px; }
  .notice { padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .notice p { margin: 0 0 6px; }
  .empty { color: var(--text-muted); }
  code { font-family: var(--mono); color: var(--text); }
</style>
