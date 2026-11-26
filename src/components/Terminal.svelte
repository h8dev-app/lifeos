<script lang="ts">
  import { onMount } from "svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";
  import { onPtyData, onPtyExit, ptyKill, ptyResize, ptySpawn, ptyWrite } from "../lib/pty";

  // One `claude` session in a terminal. The session lives as long as this
  // component: hiding the overlay or changing view does not stop it.
  let { cwd, onexit }: { cwd: string | null; onexit: (code: number | null) => void } = $props();

  let host: HTMLDivElement;
  let term: Terminal;
  let error = $state("");

  export function focus() {
    term?.focus();
  }

  onMount(() => {
    term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Cascadia Code", ui-monospace, monospace',
      fontSize: 14,
      allowTransparency: true,
      theme: { background: "rgba(0,0,0,0)", foreground: "#eef0f5", cursor: "#7aa2ff", selectionBackground: "#7aa2ff55" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    let id: number | null = null;
    let disposed = false;
    const buffered: string[] = []; // output that arrives before we know our id

    const safeFit = () => {
      // Hidden (other view): size is 0, keep the last size.
      if (host.clientWidth === 0 || host.clientHeight === 0) return;
      fit.fit();
      if (id !== null) ptyResize(id, term.cols, term.rows).catch(() => {});
    };
    safeFit();

    const unData = onPtyData((e) => {
      if (id === null) buffered.push(JSON.stringify(e));
      else if (e.id === id) term.write(e.data);
    });
    const unExit = onPtyExit((e) => {
      if (e.id !== id) return;
      term.write(`\r\n\x1b[90m[session terminée${e.code !== null ? `, code ${e.code}` : ""}]\x1b[0m\r\n`);
      id = null;
      onexit(e.code);
    });

    const input = term.onData((data) => {
      if (id !== null) ptyWrite(id, data).catch(() => {});
    });

    const observer = new ResizeObserver(() => safeFit());
    observer.observe(host);

    ptySpawn(cwd, term.cols, term.rows)
      .then((newId) => {
        if (disposed) { ptyKill(newId); return; }
        id = newId;
        for (const raw of buffered.splice(0)) {
          const e = JSON.parse(raw) as { id: number; data: string };
          if (e.id === id) term.write(e.data);
        }
        term.focus();
      })
      .catch((e) => {
        error = String(e);
        onexit(null);
      });

    return () => {
      disposed = true;
      observer.disconnect();
      input.dispose();
      unData.then((f) => f());
      unExit.then((f) => f());
      if (id !== null) ptyKill(id);
      term.dispose();
    };
  });
</script>

{#if error}<p class="error">Impossible de lancer claude : {error}</p>{/if}
<div class="term" bind:this={host}></div>

<style>
  .term { flex: 1; min-height: 0; padding: 8px; background: rgba(6, 8, 14, 0.62); border: 1px solid var(--glass-border); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); box-shadow: var(--glass-rim); border-radius: var(--radius); }
  .term :global(.xterm) { height: 100%; }
  .term :global(.xterm-viewport) { background: transparent !important; }
  .error { color: var(--error); margin: 0 0 8px; }
</style>
