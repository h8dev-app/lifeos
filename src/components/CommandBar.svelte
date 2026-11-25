<script lang="ts">
  // Single input bar. The parent parses and saves the text.
  // `onsubmit` returns true when the text was handled: the bar is cleared.
  // On false (error), the text stays so the user can fix it.
  let { onsubmit }: { onsubmit?: (text: string) => boolean | Promise<boolean> } = $props();

  let value = $state("");
  let input: HTMLInputElement;

  export function focus() {
    input?.focus();
    input?.select();
  }

  /** Put text in the bar (category chips) and keep the cursor at the end. */
  export function fill(text: string) {
    value = text;
    input?.focus();
  }

  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    busy = true;
    try {
      if (await onsubmit?.(text)) value = "";
    } finally {
      busy = false;
    }
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
