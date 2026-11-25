<script lang="ts">
  import { onMount } from "svelte";
  import CommandBar from "./components/CommandBar.svelte";
  import CategoryChips from "./components/CategoryChips.svelte";
  import Nav from "./components/Nav.svelte";
  import Toast from "./components/Toast.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import Tasks from "./views/Tasks.svelte";
  import Notes from "./views/Notes.svelte";
  import { app, guard, reloadEntries, reloadTasks, say, type View } from "./lib/app.svelte";
  import { closeOverlay, onOverlayShown } from "./lib/overlay";
  import { createCategory } from "./lib/db/categories";
  import { addEntry } from "./lib/db/entries";
  import { addTask } from "./lib/db/tasks";
  import { createNote } from "./lib/db/notes";
  import { parseCatArgs, parseInput } from "./lib/parsing/slash";
  import { parseTaskArgs } from "./lib/parsing/task";
  import { formatEntryData } from "./lib/format";
  import { formatDay } from "./lib/dates";

  let bar: CommandBar;

  async function handle(text: string): Promise<boolean> {
    const r = parseInput(text, app.categories);
    const ok = await guard(async (): Promise<boolean> => {
      switch (r.kind) {
        case "entry":
          await addEntry(r.category.id, r.data);
          say(`✓ ${r.category.icon ?? ""} ${r.category.name} : ${formatEntryData(r.category, r.data)}`, "ok");
          await reloadEntries();
          return true;
        case "builtin":
          switch (r.command) {
            case "cat": return handleCat(r.args);
            case "tache": return handleTask(r.args);
            case "note": return handleNote(r.args);
            case "claude": say("/claude arrive au jalon 6."); return false;
          }
          return false;
        case "freetext":
          say("Texte libre → IA au jalon 4. Utilise une commande /… pour l'instant.");
          return false;
        case "error":
          say(r.message, "error");
          return false;
      }
    });
    return ok ?? false;
  }

  async function handleTask(args: string): Promise<boolean> {
    const parsed = parseTaskArgs(args);
    if ("error" in parsed) { say(parsed.error, "error"); return false; }
    await addTask(parsed.title, parsed.dueDate);
    await reloadTasks();
    say(`✓ Tâche ajoutée${parsed.dueDate ? ` (échéance ${formatDay(parsed.dueDate)})` : ""}.`, "ok");
    return true;
  }

  /** `/note` opens the Notes view; `/note <titre>` creates the note and opens it. */
  async function handleNote(args: string): Promise<boolean> {
    if (args.trim()) {
      const note = await createNote(args.trim());
      app.openNoteId = note.id;
    }
    app.view = "notes";
    say("");
    return true;
  }

  async function handleCat(args: string): Promise<boolean> {
    const parsed = parseCatArgs(args);
    if ("error" in parsed) { say(parsed.error, "error"); return false; }
    if (app.categories.some((c) => c.slug === parsed.slug)) {
      say(`La catégorie /${parsed.slug} existe déjà.`, "error");
      return false;
    }
    await createCategory(parsed);
    await reloadEntries();
    const fields = parsed.fields.map((f) => f.label).join(", ") || "texte libre en note";
    say(`✓ Catégorie ${parsed.icon ?? ""} /${parsed.slug} créée (${fields}).`, "ok");
    return true;
  }

  const VIEWS: View[] = ["dashboard", "tasks", "notes"];

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeOverlay();
    } else if ((e.ctrlKey || e.metaKey) && ["1", "2", "3"].includes(e.key)) {
      e.preventDefault();
      app.view = VIEWS[Number(e.key) - 1];
    }
  }

  onMount(() => {
    bar.focus();
    Promise.all([reloadEntries(), reloadTasks()]).catch((e) =>
      say(`Base de données indisponible : ${e}`, "error"),
    );
    // Rust emits this each time the overlay appears.
    const unlisten = onOverlayShown(() => {
      say("");
      reloadTasks(); // the day may have changed while hidden
      if (app.view !== "notes") bar.focus();
    });
    return () => { unlisten.then((f) => f()); };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <Nav />
  <div class="content">
    {#if app.view === "dashboard"}<Dashboard />
    {:else if app.view === "tasks"}<Tasks />
    {:else}<Notes />{/if}
  </div>
  <footer>
    <Toast message={app.toast.message} kind={app.toast.kind} />
    <CommandBar bind:this={bar} onsubmit={handle} />
    {#if app.view === "dashboard"}
      <CategoryChips categories={app.categories} onpick={(cmd) => bar.fill(cmd)} />
    {/if}
    <p class="hint">Échap pour fermer · Ctrl+1/2/3 pour changer de vue</p>
  </footer>
</main>

<style>
  main {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--overlay-bg);
    padding: 32px 24px 24px;
  }
  .content { flex: 1; overflow: auto; min-height: 0; }
  footer { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 16px; }
  .hint { margin: 0; color: var(--text-muted); font-size: 12px; }
</style>
