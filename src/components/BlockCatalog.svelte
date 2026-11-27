<script lang="ts">
  import Icon from "./Icon.svelte";
  import { BLOCK_TYPE_IDS, BLOCK_TYPES, type BlockType } from "../lib/dashboard/layout";

  // "Ajouter un bloc": every block type with an explicit name and what it shows.
  let { onpick, oncancel }: { onpick: (type: BlockType) => void; oncancel: () => void } = $props();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); oncancel(); }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={oncancel} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog glass-strong" role="dialog" aria-modal="true" aria-labelledby="bc-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2 id="bc-title">Ajouter un bloc</h2>
      <button class="close" onclick={oncancel} aria-label="Fermer"><Icon name="x" /></button>
    </header>
    <p class="hint">Tu pourras ensuite le renommer et choisir son contenu (bouton <Icon name="settings" size={12} /> du bloc).</p>
    <div class="grid">
      {#each BLOCK_TYPE_IDS as t (t)}
        <!-- svelte-ignore a11y_autofocus -->
        <button class="type" onclick={() => onpick(t)} autofocus={t === "clock"}>
          <span class="ic"><Icon name={BLOCK_TYPES[t].icon} size={18} /></span>
          <span class="txt"><strong>{BLOCK_TYPES[t].label}</strong><small>{BLOCK_TYPES[t].desc}</small></span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 10; background: var(--backdrop);
    display: flex; align-items: center; justify-content: center;
  }
  .dialog { width: min(720px, calc(100% - 32px)); max-height: 85vh; overflow: auto; border-radius: var(--radius); padding: 20px; }
  header { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 18px; }
  .close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }
  .hint { color: var(--text-muted); font-size: 13px; margin: 6px 0 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
  .type {
    display: flex; align-items: flex-start; gap: 12px; padding: 12px; text-align: left; cursor: pointer;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text); font: inherit;
  }
  .type:hover, .type:focus-visible { border-color: var(--accent); transform: translateY(-1px); outline: none; }
  .ic {
    display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px;
    background: var(--accent-soft); color: var(--accent);
  }
  .txt { display: flex; flex-direction: column; gap: 2px; }
  small { color: var(--text-muted); font-size: 12px; line-height: 1.4; }
</style>
