<script lang="ts">
  // Single input bar. Milestone 1: focus handling only.
  // Milestone 2 adds slash-command parsing, milestone 4 free text -> AI.
  let { onsubmit }: { onsubmit?: (text: string) => void } = $props();

  let value = $state("");
  let input: HTMLInputElement;

  export function focus() {
    input?.focus();
    input?.select();
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onsubmit?.(text);
    value = "";
  }
</script>

<form class="bar" onsubmit={submit}>
  <span class="prompt" aria-hidden="true">›</span>
  <input
    bind:this={input}
    bind:value
    placeholder="/sport course 5km 28min  ·  /tache …  ·  ou texte libre"
    autocomplete="off"
    spellcheck="false"
    aria-label="Barre de saisie"
  />
</form>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(760px, 100%);
    padding: 14px 18px;
    background: var(--surface-strong);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .bar:focus-within { border-color: var(--accent); }
  .prompt { color: var(--accent); font-size: 20px; }
  input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font: 17px var(--mono);
  }
  input::placeholder { color: var(--text-muted); }
</style>
