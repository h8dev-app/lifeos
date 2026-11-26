<script lang="ts">
  import { onMount } from "svelte";
  import { app, guard, reloadSettings, runGithubSync, say } from "../lib/app.svelte";
  import { isValidGithubUser } from "../lib/activity/github";
  import { formatWhen } from "../lib/clock";
  import { applyAppearance, saveSetting, type ProviderId, type Settings } from "../lib/settings";
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
    if (ok) say("✓ Clé enregistrée dans le trousseau système.", "ok");
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
  <div class="grid">
    <label for="opacity">Voile sombre</label>
    <div class="range">
      <input id="opacity" type="range" min="0" max="0.95" step="0.05" value={app.settings.overlayOpacity}
        oninput={(e) => applyAppearance({ overlayOpacity: Number(e.currentTarget.value) })}
        onchange={(e) => set("overlayOpacity", Number(e.currentTarget.value))} />
      <span>{Math.round(app.settings.overlayOpacity * 100)} %</span>
    </div>
    <label for="tint">Teinte des panneaux</label>
    <div class="range">
      <input id="tint" type="range" min="0" max="0.8" step="0.05" value={app.settings.glassTint}
        oninput={(e) => applyAppearance({ glassTint: Number(e.currentTarget.value) })}
        onchange={(e) => set("glassTint", Number(e.currentTarget.value))} />
      <span>{Math.round(app.settings.glassTint * 100)} %</span>
    </div>
    <label for="blur">Flou des panneaux</label>
    <div class="range">
      <input id="blur" type="range" min="0" max="40" step="1" value={app.settings.glassBlur}
        oninput={(e) => applyAppearance({ glassBlur: Number(e.currentTarget.value) })}
        onchange={(e) => set("glassBlur", Number(e.currentTarget.value))} />
      <span>{app.settings.glassBlur} px</span>
    </div>
  </div>
  <p class="hint">LifeOS affiche ton fond d'écran derrière ses panneaux en verre. Voile : assombrit tout le fond d'écran. Teinte et flou : à 0, les panneaux sont du verre clair qui laisse tout voir. Un nouveau fond d'écran est repris à la prochaine ouverture.</p>

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
    {:else if status.ok}<span class="ok">✓ Prêt</span>
    {:else}<span class="err">✗ {status.reason}</span>{/if}
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
        <span class="ok">✓ enregistrée</span>
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
  section { width: min(760px, 100%); margin: 0 auto; height: 100%; overflow: auto; padding: 4px 24px 24px; border-radius: var(--radius); }
  .range { display: flex; align-items: center; gap: 12px; }
  .range input { flex: 1; accent-color: var(--accent); }
  .range span { color: var(--text-muted); font-size: 13px; min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin: 28px 0 10px; }
  .providers { display: flex; flex-direction: column; gap: 6px; }
  .providers label {
    display: flex; gap: 10px; align-items: center; padding: 10px 12px;
    background: var(--surface); border: 1px solid transparent; border-radius: 8px; cursor: pointer;
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
