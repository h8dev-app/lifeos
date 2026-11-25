<script lang="ts">
  import { onMount } from "svelte";
  import CommandBar from "./components/CommandBar.svelte";
  import CategoryChips from "./components/CategoryChips.svelte";
  import Toast, { type ToastKind } from "./components/Toast.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import { hideOverlay, onOverlayShown } from "./lib/overlay";
  import { createCategory, listCategories } from "./lib/db/categories";
  import { addEntry, deleteEntry, listRecentEntries, type RecentEntry } from "./lib/db/entries";
  import { parseCatArgs, parseInput, type Builtin } from "./lib/parsing/slash";
  import { formatEntryData } from "./lib/format";
  import type { Category } from "./lib/types";

  let bar: CommandBar;
  let categories = $state<Category[]>([]);
  let recent = $state<RecentEntry[]>([]);
  let toast = $state<{ message: string; kind: ToastKind }>({ message: "", kind: "info" });

  const say = (message: string, kind: ToastKind = "info") => (toast = { message, kind });

  async function reload() {
    [categories, recent] = await Promise.all([listCategories(), listRecentEntries(10)]);
  }

  /** Milestone where each not-yet-built command arrives. */
  const LATER: Partial<Record<Builtin, string>> = { tache: "3", note: "3", claude: "6" };

  async function handle(text: string): Promise<boolean> {
    const r = parseInput(text, categories);
    try {
      switch (r.kind) {
        case "entry": {
          await addEntry(r.category.id, r.data);
          say(`✓ ${r.category.icon ?? ""} ${r.category.name} : ${formatEntryData(r.category, r.data)}`, "ok");
          await reload();
          return true;
        }
        case "builtin": {
          if (r.command === "cat") return await handleCat(r.args);
          say(`/${r.command} arrive au jalon ${LATER[r.command]}.`);
          return false;
        }
        case "freetext":
          say("Texte libre → IA au jalon 4. Utilise une commande /… pour l'instant.");
          return false;
        case "error":
          say(r.message, "error");
          return false;
      }
    } catch (e) {
      say(`Erreur base de données : ${e}`, "error");
      return false;
    }
  }

  async function handleCat(args: string): Promise<boolean> {
    const parsed = parseCatArgs(args);
    if ("error" in parsed) {
      say(parsed.error, "error");
      return false;
    }
    if (categories.some((c) => c.slug === parsed.slug)) {
      say(`La catégorie /${parsed.slug} existe déjà.`, "error");
      return false;
    }
    await createCategory(parsed);
    await reload();
    const fields = parsed.fields.map((f) => f.label).join(", ") || "texte libre en note";
    say(`✓ Catégorie ${parsed.icon ?? ""} /${parsed.slug} créée (${fields}).`, "ok");
    return true;
  }

  async function remove(id: string) {
    try {
      await deleteEntry(id);
      await reload();
      say("Entrée supprimée.");
    } catch (e) {
      say(`Erreur base de données : ${e}`, "error");
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideOverlay();
    }
  }

  onMount(() => {
    bar.focus();
    reload().catch((e) => say(`Base de données indisponible : ${e}`, "error"));
    // Rust emits this each time the overlay appears: focus the bar again.
    const unlisten = onOverlayShown(() => {
      say("");
      bar.focus();
    });
    // Fallback: some compositors give focus later than the "shown" event.
    const onFocus = () => bar.focus();
    window.addEventListener("focus", onFocus);
    return () => {
      unlisten.then((f) => f());
      window.removeEventListener("focus", onFocus);
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <div class="content">
    <Dashboard {categories} {recent} ondelete={remove} />
  </div>
  <footer>
    <Toast message={toast.message} kind={toast.kind} />
    <CommandBar bind:this={bar} onsubmit={handle} />
    <CategoryChips {categories} onpick={(cmd) => bar.fill(cmd)} />
    <p class="hint">Échap pour fermer</p>
  </footer>
</main>

<style>
  main {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--overlay-bg);
    padding: 64px 24px 32px;
  }
  .content { flex: 1; overflow: auto; }
  footer { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 16px; }
  .hint { margin: 0; color: var(--text-muted); font-size: 12px; }
</style>
