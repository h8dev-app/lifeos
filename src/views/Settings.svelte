<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { onMount } from "svelte";
  import { app, guard, reloadSettings, runGithubSync, say, toggleScreenWidget } from "../lib/app.svelte";
  import { blockTitle } from "../lib/dashboard/layout";
  import { ALL_TABS, LOCKED_TABS, moveTab, parseTabs, toggleTab } from "../lib/ui/tabs";
  import { isValidGithubUser } from "../lib/activity/github";
  import { formatWhen } from "../lib/clock";
  import { saveSetting, type ProviderId, type Settings } from "../lib/settings";
  import {
    ACCENT_CHOICES, ACCENTS, applyAppearance, paletteOf, resolveTheme, STYLE_PRESETS, THEME_CHOICES, THEMES, type UiStyle,
  } from "../lib/theme";
  import { deleteSecret, secretExists, setSecret, type SecretName } from "../lib/secrets";
  import { getProvider } from "../lib/ai/registry";
  import type { ProviderStatus } from "../lib/ai/provider";
  import { disable as autostartOff, enable as autostartOn, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";

  const PROVIDERS: { id: ProviderId; label: string; hint: string }[] = [
    { id: "ollama", label: "Ollama (local, gratuit)", hint: "Tourne sur ta machine, rien ne sort." },
    { id: "anthropic", label: "Anthropic (ta clé API)", hint: "Payant à l'usage, sur ta clé." },
    { id: "openai", label: "OpenAI (ta clé API)", hint: "Payant à l'usage, sur ta clé." },
  ];
  const KEYS: { name: SecretName; label: string; url: string }[] = [
    { name: "anthropic_api_key", label: "Clé API Anthropic", url: "https://console.anthropic.com/settings/keys" },
    { name: "openai_api_key", label: "Clé API OpenAI", url: "https://platform.openai.com/api-keys" },
    { name: "github_token", label: "Token GitHub (optionnel)", url: "https://github.com/settings/tokens" },
  ];

  let githubInput = $state(app.settings.githubUser);
  $effect(() => { githubInput = app.settings.githubUser; });

  async function saveGithubUser() {
    const user = githubInput.trim();
    if (user && !isValidGithubUser(user)) { say(`Pseudo GitHub invalide : « ${user} ».`, "error"); return; }
    await set("githubUser", user);
    if (user) { say("Synchronisation GitHub…"); await runGithubSync(); say(""); }
  }

  let status = $state<ProviderStatus | null>(null);
  let keySet = $state<Record<string, boolean>>({});
  let keyInput = $state<Record<string, string>>({});

  async function refreshStatus() {
    status = null;
    status = await getProvider(app.settings).status();
  }

  async function refreshKeys() {
    for (const k of KEYS) keySet[k.name] = (await guard(() => secretExists(k.name))) ?? false;
  }

  let autostart = $state<boolean | null>(null);
  const isDev = import.meta.env.DEV;

  async function toggleAutostart(on: boolean) {
    await guard(() => (on ? autostartOn() : autostartOff()));
    autostart = (await guard(autostartEnabled)) ?? false;
  }

  onMount(async () => {
    refreshStatus();
    refreshKeys();
    autostart = (await guard(autostartEnabled)) ?? false;
  });

  // Palette of the chosen theme, for the accent swatches (reactive on settings).
  const pal = $derived(paletteOf(resolveTheme(app.settings.theme, matchMedia("(prefers-color-scheme: dark)").matches), app.settings.accent));

  /** A style also puts its panel opacity and blur in place (sliders can change them after). */
  async function chooseStyle(style: UiStyle) {
    const preset = STYLE_PRESETS[style];
    await guard(async () => {
      await saveSetting("style", style);
      await saveSetting("panelOpacity", preset.panelOpacity);
      await saveSetting("glassBlur", preset.glassBlur);
    });
    await reloadSettings();
  }

  const tabs = $derived(parseTabs(app.settings.tabs));

  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    await guard(() => saveSetting(key, value));
    await reloadSettings();
    refreshStatus();
  }

  async function saveKey(name: SecretName) {
    const value = (keyInput[name] ?? "").trim();
    if (!value) return;
    const ok = await guard(async () => { await setSecret(name, value); return true; });
    keyInput[name] = ""; // never keep the key in the page
    if (ok) say("Clé enregistrée dans le trousseau système.", "ok");
    await refreshKeys();
    refreshStatus();
  }

  async function removeKey(name: SecretName) {
    await guard(() => deleteSecret(name));
    say("Clé supprimée du trousseau.");
    await refreshKeys();
    refreshStatus();
  }
</script>

<section class="glass">
  <h2>Apparence</h2>
  <p class="label">Style</p>
  <div class="styles" role="radiogroup" aria-label="Style">
    {#each [
      { id: "sobre", label: "Sobre", hint: "Panneaux plats, bordures fines" },
      { id: "glass", label: "Liquid glass", hint: "Verre translucide, reflets, lumière qui suit la souris" },
    ] as const as st (st.id)}
      <button role="radio" aria-checked={app.settings.style === st.id} class="style" class:on={app.settings.style === st.id}
        onclick={() => chooseStyle(st.id)}>
        <span class="sprev">
          <span class="spanel" class:flat={st.id === "sobre"} class:glassy={st.id === "glass"}></span>
          <span class="spanel small" class:flat={st.id === "sobre"} class:glassy={st.id === "glass"}></span>
        </span>
        <span class="stext"><strong>{st.label}</strong><small>{st.hint}</small></span>
      </button>
    {/each}
  </div>

  <p class="label">Thème</p>
  <div class="themes" role="radiogroup" aria-label="Thème">
    {#each THEME_CHOICES as id (id)}
      {@const p = id === "auto" ? null : paletteOf(id, app.settings.accent)}
      <button role="radio" aria-checked={app.settings.theme === id} class="theme" class:on={app.settings.theme === id}
        onclick={() => set("theme", id)}>
        {#if p}
          <span class="swatch" style:background={p.veil}>
            <span class="mini" style:background={p.panel} style:border-color={p.border}>
              <span class="line" style:background={p.text}></span>
              <span class="line short" style:background={p.muted}></span>
              <span class="dot" style:background={p.accent}></span>
            </span>
          </span>
        {:else}
          {@const d = paletteOf("graphite", app.settings.accent)}
          {@const l = paletteOf("clair", app.settings.accent)}
          <span class="swatch split">
            <span style:background={d.veil}><span class="mini" style:background={d.panel} style:border-color={d.border}>
              <span class="line" style:background={d.text}></span><span class="dot" style:background={d.accent}></span></span></span>
            <span style:background={l.veil}><span class="mini" style:background={l.panel} style:border-color={l.border}>
              <span class="line" style:background={l.text}></span><span class="dot" style:background={l.accent}></span></span></span>
          </span>
        {/if}
        <span class="tname">{id === "auto" ? "Auto (système)" : THEMES[id].label}</span>
      </button>
    {/each}
  </div>

  <p class="label">Couleur d'accent</p>
  <div class="accents" role="radiogroup" aria-label="Couleur d'accent">
    {#each ACCENT_CHOICES as id (id)}
      {@const color = id === "theme" ? paletteOf(resolveTheme(app.settings.theme, pal.dark), "theme").accent : (pal.dark ? ACCENTS[id].dark : ACCENTS[id].light)}
      <button role="radio" aria-checked={app.settings.accent === id} class="accent" class:on={app.settings.accent === id}
        title={id === "theme" ? "Celle du thème" : ACCENTS[id].label} onclick={() => set("accent", id)}>
        <span style:background={color}>{id === "theme" ? "A" : ""}</span>
      </button>
    {/each}
  </div>

  <p class="label">Derrière LifeOS</p>
  <div class="providers bgmode">
    {#each [
      { id: "transparent", label: "Transparent", hint: "Tes fenêtres ouvertes restent visibles, comme sous un calque" },
      { id: "wallpaper", label: "Fond d'écran", hint: "Ton fond d'écran, plein écran (le flou des panneaux n'agit que dans ce mode)" },
    ] as const as m (m.id)}
      <label class:active={app.settings.backgroundMode === m.id}>
        <input type="radio" name="bgmode" checked={app.settings.backgroundMode === m.id}
          onchange={() => set("backgroundMode", m.id)} />
        <span><strong>{m.label}</strong><small>{m.hint}</small></span>
      </label>
    {/each}
  </div>
  <div class="grid sliders">
    <label for="opacity">Voile</label>
    <div class="range">
      <input id="opacity" type="range" min="0" max="0.95" step="0.05" value={app.settings.overlayOpacity}
        oninput={(e) => applyAppearance({ overlayOpacity: Number(e.currentTarget.value) })}
        onchange={(e) => set("overlayOpacity", Number(e.currentTarget.value))} />
      <span>{Math.round(app.settings.overlayOpacity * 100)} %</span>
    </div>
    <label for="panels">Panneaux</label>
    <div class="range">
      <input id="panels" type="range" min="0.3" max="1" step="0.02" value={app.settings.panelOpacity}
        oninput={(e) => applyAppearance({ panelOpacity: Number(e.currentTarget.value) })}
        onchange={(e) => set("panelOpacity", Number(e.currentTarget.value))} />
      <span>{Math.round(app.settings.panelOpacity * 100)} %</span>
    </div>
    <label for="blur">Flou</label>
    <div class="range">
      <input id="blur" type="range" min="0" max="40" step="1" value={app.settings.glassBlur}
        oninput={(e) => applyAppearance({ glassBlur: Number(e.currentTarget.value) })}
        onchange={(e) => set("glassBlur", Number(e.currentTarget.value))} />
      <span>{app.settings.glassBlur} px</span>
    </div>
  </div>
  <p class="hint">Voile : couvre ce qui est derrière LifeOS. Panneaux : à 100 %, ils sont opaques et rien ne passe à travers.</p>

  <h2>Onglets</h2>
  <p class="hint">Choisis les onglets affichés et leur ordre (Ctrl+1, Ctrl+2… suivent cet ordre). Accueil et Réglages restent toujours là.</p>
  <ul class="tabs">
    {#each [...tabs, ...ALL_TABS.map((t) => t.view).filter((v) => !tabs.includes(v))] as v, i (v)}
      {@const t = ALL_TABS.find((x) => x.view === v)!}
      {@const shown = tabs.includes(v)}
      <li class:off={!shown}>
        <input type="checkbox" checked={shown} disabled={LOCKED_TABS.includes(v)}
          onchange={() => set("tabs", toggleTab(tabs, v).join(","))} aria-label="Afficher {t.label}" />
        <Icon name={t.icon} size={15} />
        <span class="tl">{t.label}</span>
        {#if shown}
          <span class="kbd">Ctrl+{i + 1}</span>
          <button class="mv" disabled={i === 0} onclick={() => set("tabs", moveTab(tabs, v, -1).join(","))} aria-label="Monter {t.label}"><Icon name="chevron-left" size={14} /></button>
          <button class="mv" disabled={i === tabs.length - 1} onclick={() => set("tabs", moveTab(tabs, v, 1).join(","))} aria-label="Descendre {t.label}"><Icon name="chevron-right" size={14} /></button>
        {/if}
      </li>
    {/each}
  </ul>

  <h2>Widgets d'écran</h2>
  <p class="hint">Un bloc de l'accueil en petite fenêtre, toujours au premier plan, qui reste affiché quand LifeOS est masqué (ex. l'agenda en haut à gauche pendant une vidéo). Glisse-le par son titre, redimensionne-le par le coin ; sa place est gardée. Aussi depuis l'accueil : bouton <Icon name="picture-in-picture-2" size={13} /> d'un bloc.</p>
  <div class="widgets">
    {#each app.blocks as b (b.id)}
      <label class="check">
        <input type="checkbox" checked={app.screenWidgets.includes(b.id)} onchange={() => toggleScreenWidget(b.id)} />
        {blockTitle(b)}
      </label>
    {/each}
  </div>

  <h2>Démarrage</h2>
  <label class="check">
    <input type="checkbox" checked={!!autostart} disabled={autostart === null || isDev}
      onchange={(e) => toggleAutostart(e.currentTarget.checked)} />
    Lancer LifeOS au démarrage de la session (caché, dans la zone de notification)
  </label>
  {#if isDev}<p class="hint">Désactivé en mode dev : il enregistrerait le binaire de développement.</p>{/if}

  <h2>Bilan hebdomadaire</h2>
  <label class="check">
    <input type="checkbox" checked={app.settings.weeklyReviewAuto}
      onchange={(e) => set("weeklyReviewAuto", e.currentTarget.checked)} />
    Générer automatiquement le bilan de la semaine passée, à partir du lundi
  </label>
  <p class="hint">Note <code>bilan-AAAA-sNN.md</code> dans Notes. Chiffres calculés par LifeOS, texte écrit par l'IA choisie ci-dessous. À la main : <code>/bilan</code> (semaine en cours) ou <code>/bilan -1</code>.</p>

  <h2>IA</h2>
  <div class="providers">
    {#each PROVIDERS as p (p.id)}
      <label class:active={app.settings.aiProvider === p.id}>
        <input type="radio" name="provider" checked={app.settings.aiProvider === p.id}
          onchange={() => set("aiProvider", p.id)} />
        <span><strong>{p.label}</strong><small>{p.hint}</small></span>
      </label>
    {/each}
  </div>

  <p class="status">
    {#if status === null}Vérification…
    {:else if status.ok}<span class="ok"><Icon name="circle-check" size={14} /> Prêt</span>
    {:else}<span class="err"><Icon name="circle-alert" size={14} /> {status.reason}</span>{/if}
    <button class="link" onclick={refreshStatus}>Revérifier</button>
  </p>

  <h2>Modèles</h2>
  <div class="grid">
    <label for="m-ollama">Ollama</label>
    <input id="m-ollama" value={app.settings.ollamaModel} onchange={(e) => set("ollamaModel", e.currentTarget.value)} />
    <label for="m-anthropic">Anthropic</label>
    <input id="m-anthropic" value={app.settings.anthropicModel} onchange={(e) => set("anthropicModel", e.currentTarget.value)} />
    <label for="m-openai">OpenAI</label>
    <input id="m-openai" value={app.settings.openaiModel} onchange={(e) => set("openaiModel", e.currentTarget.value)} />
  </div>
  <p class="hint">Anthropic : <code>claude-opus-5-5</code> (le plus capable), <code>claude-haiku-5-5</code> (environ 40× moins cher, suffisant pour ça).</p>

  <h2>GitHub</h2>
  <p class="hint">Les pushs publics de ce compte sont ajoutés à la catégorie Code toutes les 10 minutes. Un token (ci-dessous) donne plus de requêtes et les dépôts privés auxquels il a accès.</p>
  <div class="grid">
    <label for="gh-user">Pseudo</label>
    <input id="gh-user" placeholder="ex. torvalds" bind:value={githubInput}
      onkeydown={(e) => e.key === "Enter" && saveGithubUser()} onblur={saveGithubUser} />
  </div>
  {#if app.github}
    <p class="hint">
      Dernière synchro {formatWhen(app.github.at)} :
      {#if "error" in app.github}<span class="err">{app.github.error}</span>
      {:else}{app.github.added} nouveau(x) push(s).{/if}
      <button class="link" onclick={runGithubSync}>Synchroniser</button>
    </p>
  {/if}

  <h2>Clés API</h2>
  <p class="hint">Stockées dans le trousseau système (Secret Service / Gestionnaire d'identifiants). L'appli ne peut pas les relire, seulement s'en servir.</p>
  {#each KEYS as k (k.name)}
    <div class="key">
      <label for={k.name}>{k.label}</label>
      {#if keySet[k.name]}
        <span class="ok"><Icon name="check" size={14} /> enregistrée</span>
        <button onclick={() => removeKey(k.name)}>Supprimer</button>
      {:else}
        <input id={k.name} type="password" autocomplete="off" placeholder="Colle ta clé ici"
          bind:value={keyInput[k.name]} onkeydown={(e) => e.key === "Enter" && saveKey(k.name)} />
        <button onclick={() => saveKey(k.name)}>Enregistrer</button>
      {/if}
    </div>
  {/each}
</section>

<style>
  section { width: min(760px, 100%); margin: 0 auto; height: 100%; overflow: auto; padding: 4px 28px 28px; border-radius: var(--radius); }
  .bgmode { margin-bottom: 12px; }
  .range { display: flex; align-items: center; gap: 12px; }
  .range input { flex: 1; accent-color: var(--accent); }
  .range span { color: var(--text-muted); font-size: 13px; min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; padding: 24px 0 12px; border-top: 1px solid var(--border); }
  section > h2:first-child { border-top: none; padding-top: 16px; }
  .label { margin: 14px 0 8px; font-size: 13px; color: var(--text-muted); }

  .styles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .style {
    display: flex; align-items: center; gap: 12px; padding: 10px; text-align: left;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  }
  .style:hover { transform: translateY(-1px); border-color: var(--text-muted); }
  .style.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .stext { display: flex; flex-direction: column; gap: 2px; }
  .sprev {
    position: relative; flex-shrink: 0; width: 76px; height: 52px; border-radius: 8px; overflow: hidden;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 30%, var(--veil)));
  }
  .spanel { position: absolute; left: 8px; top: 8px; width: 46px; height: 30px; border-radius: 6px; }
  .spanel.small { left: 30px; top: 22px; width: 38px; height: 22px; }
  .spanel.flat { background: var(--panel); border: 1px solid var(--border); }
  .spanel.glassy {
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.08));
    border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  }
  .theme:hover { transform: translateY(-2px); }
  .accent:hover { transform: scale(1.08); }
  .themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
  .theme {
    display: flex; flex-direction: column; gap: 6px; padding: 6px; background: none;
    border: 1px solid var(--border); border-radius: 12px; color: var(--text-muted);
  }
  .theme:hover { border-color: var(--text-muted); }
  .theme.on { border-color: var(--accent); color: var(--text); box-shadow: 0 0 0 1px var(--accent); }
  .swatch { display: flex; height: 58px; border-radius: 8px; overflow: hidden; padding: 8px; }
  .swatch.split { padding: 0; }
  .swatch.split > span { flex: 1; display: flex; padding: 8px 4px 8px 8px; }
  .swatch.split > span + span { padding: 8px 8px 8px 4px; }
  .mini {
    flex: 1; position: relative; border: 1px solid; border-radius: 6px; padding: 8px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .line { height: 4px; width: 70%; border-radius: 2px; opacity: 0.9; }
  .line.short { width: 45%; }
  .dot { position: absolute; right: 7px; bottom: 7px; width: 9px; height: 9px; border-radius: 50%; }
  .tname { font-size: 12px; }

  .accents { display: flex; gap: 10px; flex-wrap: wrap; }
  .accent { padding: 3px; border-radius: 50%; border: 1px solid transparent; background: none; }
  .accent span {
    display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
    color: var(--on-accent); font-size: 11px; font-weight: 700;
  }
  .accent.on { border-color: var(--text); }
  .sliders { margin-top: 12px; }
  .tabs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .tabs li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; background: var(--surface); }
  .tabs li.off { opacity: 0.55; }
  .tabs .tl { flex: 1; }
  .tabs .kbd { font: 12px var(--mono); color: var(--text-muted); }
  .tabs .mv { display: grid; place-items: center; padding: 3px; }
  .tabs .mv :global(svg) { transform: rotate(90deg); }
  .tabs .mv:disabled { opacity: 0.3; cursor: default; }
  .widgets { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px 16px; }
  .providers { display: flex; flex-direction: column; gap: 6px; }
  .providers label {
    display: flex; gap: 10px; align-items: center; padding: 10px 12px;
    background: var(--surface); border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer;
  }
  .providers label.active { border-color: var(--accent); }
  .providers span { display: flex; flex-direction: column; }
  small { color: var(--text-muted); }
  input[type="radio"], input[type="checkbox"] { accent-color: var(--accent); }
  .check { display: flex; gap: 10px; align-items: center; cursor: pointer; }
  .status { margin: 10px 0 0; }
  .ok { color: var(--ok); }
  .err { color: var(--error); }
  .grid { display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: center; }
  input:not([type="radio"]):not([type="checkbox"]):not([type="range"]) {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 7px 10px; color: var(--text); font: 14px var(--mono); outline: none; min-width: 0;
  }
  input:focus { border-color: var(--accent); }
  .key { display: grid; grid-template-columns: 160px 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font: inherit; font-size: 13px;
  }
  .link { background: none; border: none; color: var(--accent); padding: 0 6px; }
  .hint { color: var(--text-muted); font-size: 13px; }
  code { font-family: var(--mono); color: var(--text); }
</style>
