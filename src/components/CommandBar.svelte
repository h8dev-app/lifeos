<script lang="ts">
  import {
    applyToken, findCommand, inputContext, matchCommands, tokenSuggestions,
    type CommandDef, type Suggestion,
  } from "../lib/commands/registry";

  // Single input bar with autocompletion.
  // - "/" + letters: list of commands (↑ ↓ to choose, Tab/Enter to complete);
  // - after the command: its syntax and parameters, plus suggestions for the
  //   word being typed (#catégorie, @date, !priorité);
  // - ↑ ↓ on an empty list: previous inputs (history of this session).
  // `onsubmit` returns true when the text was handled: the bar is cleared.
  let {
    onsubmit, commands, tokenData, onhelp,
  }: {
    onsubmit?: (text: string) => boolean | Promise<boolean>;
    commands: CommandDef[];
    tokenData: { taskCategories: string[]; noteFolders: string[] };
    onhelp: () => void;
  } = $props();

  let value = $state("");
  let input: HTMLInputElement;
  let busy = $state(false);
  let active = $state(0);
  let dismissed = $state(false); // Escape hides the list until the next key
  const history: string[] = [];
  let historyIndex = -1;

  export function focus() {
    input?.focus();
    input?.select();
  }

  /** Put text in the bar (chips, help examples) and keep the cursor at the end. */
  export function fill(text: string) {
    value = text;
    dismissed = false;
    input?.focus();
    queueMicrotask(() => input?.setSelectionRange(value.length, value.length));
  }

  const ctx = $derived(inputContext(value));
  const commandList = $derived(ctx.kind === "command" ? matchCommands(ctx.query, commands).slice(0, 8) : []);
  const current = $derived(ctx.kind === "params" ? findCommand(ctx.command, commands) : undefined);
  const suggestions = $derived<Suggestion[]>(
    ctx.kind === "params" ? tokenSuggestions(current, ctx.token, tokenData).slice(0, 8) : [],
  );
  /** Items of the open list (commands or token suggestions). */
  const listLength = $derived(ctx.kind === "command" ? commandList.length : suggestions.length);
  const open = $derived(!dismissed && listLength > 0);
  const showParams = $derived(!dismissed && ctx.kind === "params" && current !== undefined);

  // Keep the highlighted item inside the list.
  $effect(() => { if (active >= listLength) active = 0; });

  function completeCommand(c: CommandDef) {
    value = `/${c.name} `;
    active = 0;
    input.focus();
  }

  function completeToken(s: Suggestion) {
    if (ctx.kind !== "params") return;
    value = applyToken(value, ctx.tokenStart, s.insert);
    active = 0;
    input.focus();
  }

  function accept(): boolean {
    if (!open) return false;
    if (ctx.kind === "command") {
      const c = commandList[active];
      if (!c) return false;
      // "/note" + Enter: the command is complete and can run without argument.
      if (c.bare && ctx.query.toLowerCase() === c.name) return false;
      completeCommand(c);
      return true;
    }
    const s = suggestions[active];
    if (s) { completeToken(s); return true; }
    return false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && (open || showParams)) {
      e.preventDefault();
      e.stopPropagation(); // close the list, not the overlay
      dismissed = true;
      return;
    }
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + listLength) % listLength;
      return;
    }
    if (!open && (e.key === "ArrowUp" || e.key === "ArrowDown") && history.length) {
      e.preventDefault();
      historyIndex = e.key === "ArrowUp"
        ? Math.min(historyIndex + 1, history.length - 1)
        : Math.max(historyIndex - 1, -1);
      value = historyIndex === -1 ? "" : history[history.length - 1 - historyIndex];
      dismissed = true;
      return;
    }
    if (e.key === "Tab" && open) {
      e.preventDefault();
      accept();
      return;
    }
    if (e.key === "Enter" && open && accept()) {
      e.preventDefault();
      return;
    }
    if (e.key.length === 1 || e.key === "Backspace") dismissed = false;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    busy = true;
    try {
      if (await onsubmit?.(text)) {
        if (history[history.length - 1] !== text) history.push(text);
        if (history.length > 50) history.shift();
        historyIndex = -1;
        value = "";
      }
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap">
  {#if open || showParams}
    <div class="popup" role="presentation">
      {#if showParams && current}
        <div class="params glass-strong">
          <div class="syntax"><span class="icon">{current.icon ?? ""}</span><code>{current.syntax}</code></div>
          <ul>
            {#each current.params as p (p.token)}
              <li class:hot={ctx.kind === "params" && !!p.prefix && ctx.token.startsWith(p.prefix)}>
                <code>{p.token}</code><span>{p.desc}</span>
              </li>
            {/each}
          </ul>
          {#if current.examples[0]}<p class="ex">ex. <code>{current.examples[0]}</code></p>{/if}
        </div>
      {/if}
      {#if open}
        <ul class="list glass-strong" role="listbox" aria-label="Suggestions">
          {#if ctx.kind === "command"}
            {#each commandList as c, i (c.name)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <li role="option" aria-selected={i === active} class:active={i === active}
                onmousedown={(e) => e.preventDefault()} onclick={() => completeCommand(c)} onmouseenter={() => (active = i)}>
                <span class="icon">{c.icon ?? ""}</span>
                <code class="name">/{c.name}</code>
                <span class="sum">{c.summary}</span>
              </li>
            {/each}
          {:else}
            {#each suggestions as s, i (s.insert)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <li role="option" aria-selected={i === active} class:active={i === active}
                onmousedown={(e) => e.preventDefault()} onclick={() => completeToken(s)} onmouseenter={() => (active = i)}>
                <code class="name">{s.label}</code>
                {#if s.hint}<span class="sum">{s.hint}</span>{/if}
              </li>
            {/each}
          {/if}
          <li class="keys" aria-hidden="true">↑ ↓ choisir · Tab compléter · Échap masquer</li>
        </ul>
      {/if}
    </div>
  {/if}

  <form class="bar glass" onsubmit={submit}>
    <span class="prompt" aria-hidden="true">›</span>
    <input
      bind:this={input}
      bind:value
      {onkeydown}
      placeholder="Tape / pour les commandes, ou écris en texte libre"
      autocomplete="off"
      spellcheck="false"
      aria-label="Barre de saisie"
      aria-autocomplete="list"
      aria-expanded={open}
    />
    <button type="button" class="help" onclick={onhelp} title="Aide des commandes (/help)" aria-label="Aide">?</button>
  </form>
</div>

<style>
  .wrap { position: relative; width: min(760px, 100%); }
  .bar {
    display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 999px;
  }
  .bar:focus-within { border-color: var(--accent); }
  .prompt { color: var(--accent); font-size: 20px; }
  input { flex: 1; background: none; border: none; outline: none; color: var(--text); font: 17px var(--mono); }
  input::placeholder { color: var(--text-muted); }
  .help {
    width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--border); background: none;
    color: var(--text-muted); cursor: pointer; font: inherit; font-size: 13px;
  }
  .help:hover { color: var(--text); border-color: var(--accent); }

  /* The bar is at the bottom of the screen: the popup opens upwards. */
  .popup {
    position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); z-index: 20;
    display: flex; flex-direction: column; gap: 6px;
  }
  .params, .list { border-radius: var(--radius); }
  .params { padding: 12px 14px; }
  .syntax { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .syntax code { font: 14px var(--mono); color: var(--accent); }
  .params ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .params li { display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 13px; color: var(--text-muted); padding: 1px 4px; border-radius: 4px; }
  .params li.hot { background: rgba(122, 162, 255, 0.15); color: var(--text); }
  .params li code { font: 13px var(--mono); color: var(--text); }
  .ex { margin: 8px 0 0; font-size: 12px; color: var(--text-muted); }
  .ex code { font-family: var(--mono); color: var(--text); }
  .list { list-style: none; margin: 0; padding: 4px; max-height: 300px; overflow: auto; }
  .list li {
    display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 14px;
  }
  .list li.active { background: rgba(122, 162, 255, 0.18); }
  .icon { width: 20px; text-align: center; }
  .name { font: 14px var(--mono); color: var(--text); min-width: 110px; }
  .sum { color: var(--text-muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .list li.keys { cursor: default; color: var(--text-muted); font-size: 11px; justify-content: flex-end; padding: 4px 10px 2px; }
</style>
