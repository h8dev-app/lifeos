<script lang="ts">
  import { onMount } from "svelte";
  import { findCommand, type CommandDef } from "../lib/commands/registry";

  // /help: every command (grouped), its parameters and examples, plus shortcuts.
  // Click an example to put it in the bar.
  let {
    commands, focus = "", onpick, onclose,
  }: {
    commands: CommandDef[];
    focus?: string;
    onpick: (text: string) => void;
    onclose: () => void;
  } = $props();

  let filter = $state("");
  let box: HTMLDivElement;

  const GROUPS: CommandDef["group"][] = ["Saisir", "Organiser", "Outils"];
  const shown = $derived(
    filter.trim()
      ? commands.filter((c) => `${c.name} ${(c.aliases ?? []).join(" ")} ${c.summary}`.toLowerCase().includes(filter.trim().toLowerCase()))
      : commands,
  );

  onMount(() => {
    const target = focus ? findCommand(focus, commands) : undefined;
    if (target) document.getElementById(`help-${target.name}`)?.scrollIntoView({ block: "start" });
    box.focus();
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onclose(); }
  }

  const SHORTCUTS: [string, string][] = [
    ["Ctrl+Alt+Espace", "afficher / masquer LifeOS"],
    ["Échap", "fermer (une liste, une fenêtre, une note, puis l'overlay)"],
    ["Maj+Échap", "fermer l'overlay directement (utile dans le terminal Claude)"],
    ["Ctrl+1 … Ctrl+7", "Accueil, Tâches, Agenda, Notes, Activité, Claude, Réglages"],
    ["/ puis Tab", "compléter une commande"],
    ["↑ ↓ (barre vide)", "rappeler les saisies précédentes"],
    ["Ctrl+E", "aperçu Markdown dans une note"],
    ["Ctrl / Maj + clic", "sélection multiple (tâches, notes)"],
    ["Texte sans /", "l'IA propose une entrée, Entrée pour valider"],
  ];
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={onclose} {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" tabindex="-1" bind:this={box}
    onclick={(e) => e.stopPropagation()}>
    <header>
      <h2 id="help-title">Commandes</h2>
      <input placeholder="Filtrer…" bind:value={filter} aria-label="Filtrer les commandes" />
      <button class="close" onclick={onclose} aria-label="Fermer">✕</button>
    </header>

    <div class="body">
      {#each GROUPS as g (g)}
        {@const list = shown.filter((c) => c.group === g)}
        {#if list.length}
          <h3>{g}</h3>
          {#each list as c (c.name)}
            <article id="help-{c.name}" class:focus={focus && findCommand(focus, commands)?.name === c.name}>
              <div class="line">
                <span class="icon">{c.icon ?? ""}</span>
                <code class="syntax">{c.syntax}</code>
              </div>
              <p class="sum">{c.summary}{c.aliases?.length ? ` · aussi /${c.aliases.join(", /")}` : ""}</p>
              {#if c.params.length}
                <ul>{#each c.params as p (p.token)}<li><code>{p.token}</code> {p.desc}</li>{/each}</ul>
              {/if}
              <div class="examples">
                {#each c.examples as ex (ex)}
                  <button class="ex" onclick={() => onpick(ex)} title="Mettre dans la barre">{ex}</button>
                {/each}
              </div>
            </article>
          {/each}
        {/if}
      {/each}

      {#if !filter.trim()}
        <h3>Raccourcis</h3>
        <dl>
          {#each SHORTCUTS as [k, v] (k)}<dt><kbd>{k}</kbd></dt><dd>{v}</dd>{/each}
        </dl>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 15; background: var(--backdrop);
    display: flex; align-items: center; justify-content: center;
  }
  .dialog {
    width: min(760px, calc(100% - 32px)); height: min(80vh, 760px); display: flex; flex-direction: column;
    background: var(--glass-bg-strong); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); box-shadow: var(--glass-rim), var(--glass-shadow); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow); outline: none;
  }
  header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  h2 { margin: 0; font-size: 18px; flex: 1; }
  header input {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    color: var(--text); font: inherit; outline: none; width: 200px;
  }
  header input:focus { border-color: var(--accent); }
  .close { background: none; border: none; color: var(--text-muted); font-size: 16px; cursor: pointer; }
  .close:hover { color: var(--text); }
  .body { overflow: auto; padding: 8px 20px 20px; }
  h3 { font-size: 12px; color: var(--text-muted); margin: 18px 0 8px; }
  article { padding: 10px 12px; border-radius: 10px; margin-bottom: 6px; background: var(--surface); }
  article.focus { outline: 1px solid var(--accent); }
  .line { display: flex; align-items: center; gap: 8px; }
  .icon { width: 20px; text-align: center; }
  .syntax { font: 14px var(--mono); color: var(--accent); }
  .sum { margin: 4px 0 6px 28px; color: var(--text); font-size: 14px; }
  ul { margin: 0 0 6px 28px; padding: 0; list-style: none; font-size: 13px; color: var(--text-muted); }
  li code, dt kbd { font: 12px var(--mono); color: var(--text); }
  .examples { display: flex; flex-wrap: wrap; gap: 6px; margin-left: 28px; }
  .ex {
    background: var(--surface-strong); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px;
    color: var(--text); font: 12px var(--mono); cursor: pointer;
  }
  .ex:hover { border-color: var(--accent); }
  dl { display: grid; grid-template-columns: 180px 1fr; gap: 6px 12px; margin: 0; font-size: 13px; }
  dd { margin: 0; color: var(--text-muted); }
  kbd { padding: 1px 6px; border: 1px solid var(--border); border-radius: 4px; }
</style>
