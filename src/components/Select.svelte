<script lang="ts" module>
  export interface SelectOption {
    value: string;
    label: string;
    /** Optional color dot before the label. */
    color?: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import Icon from "./Icon.svelte";
  // Drop-down list drawn by the app. Native <select> lists are drawn by GTK on
  // Linux and ignore the app colors (white text on white), so we don't use them.
  let {
    options,
    value = $bindable(""),
    placeholder = "Choisir…",
    label,
    onchange,
    /** "action" = menu that resets after each choice (bulk actions). */
    mode = "value",
    /** Open the list above the button (bars at the bottom of the screen). */
    up = false,
  }: {
    options: SelectOption[];
    value?: string;
    placeholder?: string;
    label: string;
    onchange?: (value: string) => void;
    mode?: "value" | "action";
    up?: boolean;
  } = $props();

  let open = $state(false);
  let active = $state(0);
  let root: HTMLDivElement;
  let list: HTMLUListElement | undefined = $state();

  const current = $derived(options.find((o) => o.value === value));
  const shown = $derived(mode === "action" ? placeholder : (current?.label ?? placeholder));

  function toggle() {
    open = !open;
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      active = i >= 0 ? i : options.findIndex((o) => !o.disabled);
      queueMicrotask(() => list?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }));
    }
  }

  function choose(o: SelectOption) {
    if (o.disabled) return;
    open = false;
    if (mode === "value") value = o.value;
    onchange?.(o.value);
  }

  function move(step: number) {
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    active = i;
    list?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onkeydown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); toggle(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); open = false; }
    else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active]); }
    else if (e.key === "Tab") open = false;
  }

  function onWindowClick(e: MouseEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onclick={onWindowClick} />

<div class="select" bind:this={root}>
  <button type="button" class="trigger" class:placeholder={!current || mode === "action"}
    aria-haspopup="listbox" aria-expanded={open} aria-label={label} onclick={toggle} {onkeydown}>
    {#if current?.color && mode === "value"}<span class="dot" style:background={current.color}></span>{/if}
    <span class="text">{shown}</span>
    <span class="caret" aria-hidden="true"><Icon name="chevron-down" size={14} /></span>
  </button>
  {#if open}
    <ul class="menu glass-strong anim-drop" class:up role="listbox" aria-label={label} bind:this={list}>
      {#each options as o, i (o.value)}
        <!-- Keyboard is handled on the button (arrows, Enter, Escape). -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li role="option" aria-selected={o.value === value && mode === "value"} aria-disabled={o.disabled}
          data-i={i} class:active={i === active} class:selected={o.value === value && mode === "value"} class:disabled={o.disabled}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(o)} onmouseenter={() => !o.disabled && (active = i)}>
          {#if o.color}<span class="dot" style:background={o.color}></span>{/if}
          <span class="text">{o.label}</span>
          {#if o.value === value && mode === "value"}<span class="tick"><Icon name="check" size={14} /></span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .select { position: relative; display: inline-flex; min-width: 0; }
  .trigger {
    display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0;
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 6px 10px; cursor: pointer; font: inherit; font-size: inherit; text-align: left;
  }
  .trigger:hover, .trigger[aria-expanded="true"] { border-color: var(--accent); }
  .trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .placeholder .text { color: var(--text-muted); }
  .text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .caret { color: var(--text-muted); font-size: 11px; }
  .menu {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 30;
    min-width: 100%; max-width: 320px; max-height: 260px; overflow: auto;
    margin: 0; padding: 4px; list-style: none;
    background: var(--glass-bg-strong); -webkit-backdrop-filter: var(--glass-filter); backdrop-filter: var(--glass-filter); box-shadow: var(--glass-rim), var(--glass-shadow); border: 1px solid var(--border); border-radius: 10px;
    box-shadow: var(--shadow);
  }
  .menu.up { top: auto; bottom: calc(100% + 4px); }
  li {
    display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px;
    color: var(--text); cursor: pointer; white-space: nowrap; font-size: 14px;
  }
  li.active { background: var(--accent-soft); }
  li.selected { font-weight: 600; }
  li.disabled { color: var(--text-muted); cursor: default; }
  .tick { color: var(--accent); }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
</style>
