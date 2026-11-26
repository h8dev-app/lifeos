<script lang="ts">
  import { onMount } from "svelte";
  import CommandBar from "./components/CommandBar.svelte";
  import CategoryChips from "./components/CategoryChips.svelte";
  import Nav from "./components/Nav.svelte";
  import Toast from "./components/Toast.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import Tasks from "./views/Tasks.svelte";
  import Notes from "./views/Notes.svelte";
  import Settings from "./views/Settings.svelte";
  import Activity from "./views/Activity.svelte";
  import Claude from "./views/Claude.svelte";
  import Agenda from "./views/Agenda.svelte";
  import HelpDialog from "./components/HelpDialog.svelte";
  import { allCommands } from "./lib/commands/registry";
  import { checkReminders, REMINDER_INTERVAL_MS } from "./lib/agenda/reminders";
  import { atMinutes, defaultReminder, formatMinutes, parseEventArgs, type EventKind } from "./lib/agenda/agenda";
  import { createEvent } from "./lib/db/events";
  import { GITHUB_POLL_MS } from "./lib/activity/sync";
  import { loadWallpaper } from "./lib/wallpaper";
  import { autoReviewIfDue, generateReview, weekFromArgs, type ReviewResult } from "./lib/review/generate";
  import EntryPreview from "./components/EntryPreview.svelte";
  import { getProvider } from "./lib/ai/registry";
  import { app, guard, reloadEntries, reloadNoteFolders, reloadSettings, reloadTasks, runGithubSync, say, type View } from "./lib/app.svelte";
  import { closeOverlay, consumeEscape, onOverlayShown } from "./lib/overlay";
  import { createCategory } from "./lib/db/categories";
  import { addEntry } from "./lib/db/entries";
  import { addTask, ensureTaskCategory } from "./lib/db/tasks";
  import { priorityOf } from "./lib/tasks/board";
  import { createFolder, createNote } from "./lib/db/notes";
  import { parseNoteArgs } from "./lib/notes/markdown";
  import { parseCatArgs, parseInput } from "./lib/parsing/slash";
  import { parseTaskArgs } from "./lib/parsing/task";
  import { formatEntryData } from "./lib/format";
  import { formatDay } from "./lib/dates";

  let bar: CommandBar;
  const commands = $derived(allCommands(app.categories));
  const tokenData = $derived({ taskCategories: app.taskCategories.map((c) => c.name), noteFolders: app.noteFolders });

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
            case "claude": return handleClaude(r.args);
            case "bilan": return handleReview(r.args);
            case "rdv": return handleEvent(r.args, "event");
            case "memo": return handleEvent(r.args, "memo");
            case "help":
            case "aide":
              app.help = r.args.trim().replace(/^\//, "");
              return true;
          }
          return false;
        case "freetext":
          return handleFreeText(r.text);
        case "error":
          say(r.message, "error");
          return false;
      }
    });
    return ok ?? false;
  }

  /** Free text → AI → preview. Saved only after confirmation. */
  async function handleFreeText(text: string): Promise<boolean> {
    if (app.aiBusy) return false;
    const provider = getProvider(app.settings);
    const status = await provider.status();
    if (!status.ok) {
      say(`Texte libre indisponible : ${status.reason} Les commandes /… marchent toujours.`, "error");
      return false;
    }
    app.aiBusy = true;
    say(`Analyse par ${provider.label}…`);
    try {
      const r = await provider.parseEntry(text, app.categories);
      if (r.kind === "none") { say("L'IA n'a rien trouvé à enregistrer dans cette phrase.", "error"); return false; }
      if (r.kind === "error") { say(r.message, "error"); return false; }
      app.pending = { categoryId: r.category.id, data: r.data, occurredAt: r.occurredAt, text };
      say("");
      return true;
    } finally {
      app.aiBusy = false;
    }
  }

  async function confirmPending() {
    const p = app.pending;
    if (!p) return;
    const category = app.categories.find((c) => c.id === p.categoryId);
    await guard(async () => {
      await addEntry(p.categoryId, p.data, "ai", p.occurredAt);
      app.pending = null;
      await reloadEntries();
      if (category) say(`✓ ${category.icon ?? ""} ${category.name} : ${formatEntryData(category, p.data)}`, "ok");
    });
    bar.focus();
  }

  function cancelPending() {
    app.pending = null;
    say("Entrée annulée.");
    bar.focus();
  }

  /** `/claude [dossier]`: open the panel and start claude there (one session at a time). */
  function handleClaude(args: string): boolean {
    app.claude.opened = true;
    app.view = "claude";
    if (app.claude.running) {
      if (args.trim()) say(`Une session tourne déjà dans ${app.claude.cwd ?? "~/projets"}. Ferme-la pour changer de dossier.`);
      return true;
    }
    app.claude.cwd = args.trim() || null;
    app.claude.session++;
    app.claude.running = true;
    say("");
    return true;
  }

  async function handleTask(args: string): Promise<boolean> {
    const parsed = parseTaskArgs(args);
    if ("error" in parsed) { say(parsed.error, "error"); return false; }
    const categoryId = parsed.category ? await ensureTaskCategory(parsed.category) : null;
    await addTask({ title: parsed.title, dueDate: parsed.dueDate, categoryId, priority: parsed.priority ?? 2 });
    await reloadTasks();
    const bits = [
      parsed.category && `#${parsed.category}`,
      parsed.priority && priorityOf(parsed.priority).label.toLowerCase(),
      parsed.dueDate && `échéance ${formatDay(parsed.dueDate)}`,
    ].filter(Boolean);
    say(`✓ Tâche ajoutée${bits.length ? ` (${bits.join(", ")})` : ""}.`, "ok");
    return true;
  }

  /** `/note` opens the Notes view; `/note <titre>` creates the note and opens it. */
  /** `/rdv Dentiste @demain 14h30 *Lieu` · `/memo payer le loyer @vendredi [9h]` */
  async function handleEvent(args: string, kind: EventKind): Promise<boolean> {
    const p = parseEventArgs(args, kind);
    if ("error" in p) { say(p.error, "error"); return false; }
    await createEvent({
      title: p.title, kind, day: p.day, allDay: p.allDay,
      startAt: p.start !== null ? atMinutes(p.day, p.start) : null,
      endAt: p.end !== null ? atMinutes(p.day, p.end) : null,
      location: p.location, description: null, remindMinutes: defaultReminder(kind), noteId: null,
    });
    app.agendaVersion++;
    const when = `${formatDay(p.day)}${p.start !== null ? ` à ${formatMinutes(p.start)}` : ""}`;
    say(`✓ ${kind === "memo" ? "📌 Pense-bête" : "📅 Rendez-vous"} « ${p.title} » ${when}.`, "ok");
    return true;
  }

  let reviewBusy = false;

  function openReview(r: ReviewResult, prefix: string) {
    app.openNoteId = r.note.id;
    app.view = "notes";
    say(r.ai ? `✓ ${prefix}` : `${prefix} (chiffres seulement, IA indisponible : ${r.reason})`, r.ai ? "ok" : "error");
  }

  /** `/bilan` (this week) or `/bilan -1` (last week): generate and open the note. */
  async function handleReview(args: string): Promise<boolean> {
    const week = weekFromArgs(args);
    if (!week) { say("Usage : /bilan (cette semaine) ou /bilan -1 (semaine dernière).", "error"); return false; }
    if (reviewBusy) return false;
    reviewBusy = true;
    say(`Bilan de la semaine ${week.number} en cours de rédaction…`);
    try {
      openReview(await generateReview(week), `Bilan semaine ${week.number} enregistré dans Notes.`);
      return true;
    } finally {
      reviewBusy = false;
    }
  }

  /** From Monday: last week's review, once, without asking. */
  async function autoReview() {
    if (!app.settings.weeklyReviewAuto || reviewBusy) return;
    reviewBusy = true;
    try {
      const r = await autoReviewIfDue();
      if (r) say(r.ai ? `📝 Ton bilan de la semaine dernière est prêt (Notes, Ctrl+3).` : `📝 Bilan de la semaine dernière créé sans texte IA (${r.reason}).`, r.ai ? "ok" : "info");
    } catch (e) {
      console.error("auto review", e);
    } finally {
      reviewBusy = false;
    }
  }

  /** `/note` opens Notes; `/note Titre #Catégorie` creates the note and opens it. */
  async function handleNote(args: string): Promise<boolean> {
    const { title, folder } = parseNoteArgs(args);
    if (title) {
      if (folder) await createFolder(folder);
      const note = await createNote(title, folder);
      app.openNoteId = note.id;
    } else if (folder) {
      say("Donne un nom à la note : /note Titre #Catégorie", "error");
      return false;
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

  // Once the Claude panel has been shown, keep it mounted (session survives).
  $effect(() => { if (app.view === "claude") app.claude.opened = true; });

  const VIEWS: View[] = ["dashboard", "tasks", "agenda", "notes", "activity", "claude", "settings"];

  function onKeydown(e: KeyboardEvent) {
    // Inside the terminal, Escape belongs to Claude (it interrupts it).
    // Shift+Escape always closes the overlay.
    const inTerminal = (e.target as HTMLElement | null)?.closest?.(".xterm");
    if (e.key === "Escape" && inTerminal && !e.shiftKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      // First Escape cancels an AI proposal, the next one closes the overlay.
      if (app.pending) cancelPending();
      else if (e.shiftKey || !consumeEscape()) closeOverlay();
    } else if ((e.ctrlKey || e.metaKey) && ["1", "2", "3", "4", "5", "6", "7"].includes(e.key)) {
      e.preventDefault();
      app.view = VIEWS[Number(e.key) - 1];
    }
  }

  onMount(() => {
    bar.focus();
    // Settings first (GitHub username), then a first sync, then every 10 min.
    const settingsReady = reloadSettings().catch((e) => say(`Réglages illisibles : ${e}`, "error"));
    settingsReady.then(runGithubSync);
    const githubTimer = setInterval(runGithubSync, GITHUB_POLL_MS);
    // Agenda notifications, checked every 30 s while LifeOS runs (even hidden).
    const remindTick = () => checkReminders().catch((e) => console.error("reminders", e));
    remindTick();
    const reminderTimer = setInterval(remindTick, REMINDER_INTERVAL_MS);
    reloadNoteFolders().catch(() => {});
    const wallpaper = () => loadWallpaper().catch((e) => console.error("wallpaper", e));
    wallpaper();
    const dataReady = Promise.all([reloadEntries(), reloadTasks()]).catch((e) =>
      say(`Base de données indisponible : ${e}`, "error"),
    );
    // Needs settings (provider) and data (categories, streaks).
    Promise.all([settingsReady, dataReady]).then(autoReview);
    // Rust emits this each time the overlay appears.
    const unlisten = onOverlayShown(() => {
      say("");
      wallpaper(); // it may have changed while hidden
      reloadTasks(); // the day may have changed while hidden
      autoReview(); // a new week may have started while LifeOS kept running
      if (app.view === "claude") document.querySelector<HTMLElement>(".xterm-helper-textarea")?.focus();
      else if (app.view !== "notes") bar.focus();
    });
    return () => {
      unlisten.then((f) => f());
      clearInterval(githubTimer);
      clearInterval(reminderTimer);
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if app.help !== null}
  <HelpDialog {commands} focus={app.help}
    onpick={(text) => { app.help = null; bar.fill(text); }}
    onclose={() => { app.help = null; bar.focus(); }} />
{/if}

<div class="bg" aria-hidden="true"></div>
<main>
  <Nav />
  <div class="content">
    {#if app.view === "dashboard"}<Dashboard />
    {:else if app.view === "tasks"}<Tasks />
    {:else if app.view === "agenda"}<Agenda />
    {:else if app.view === "notes"}<Notes />
    {:else if app.view === "activity"}<Activity />
    {:else if app.view === "settings"}<Settings />{/if}
    <!-- Kept mounted once opened, so the claude session survives view changes. -->
    {#if app.claude.opened || app.view === "claude"}
      <div class="panel" class:hidden={app.view !== "claude"}><Claude /></div>
    {/if}
  </div>
  <footer>
    {#if app.pending}
      <EntryPreview entry={app.pending} onconfirm={confirmPending} oncancel={cancelPending} />
    {/if}
    <Toast message={app.toast.message} kind={app.toast.kind} />
    <CommandBar bind:this={bar} onsubmit={handle} {commands} {tokenData} onhelp={() => (app.help = "")} />
    {#if app.view === "dashboard"}
      <CategoryChips categories={app.categories} onpick={(cmd) => bar.fill(cmd)} />
    {/if}
  </footer>
</main>

<style>
  main {
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    /* Keeps loose text (hints, toolbars) readable on bright wallpapers. */
    text-shadow: var(--loose-shadow);
    padding: 20px 24px 16px;
  }
  /* Fixed page: views fit the window and scroll inside their own panels. */
  /* Wallpaper (or a gradient) under a dark veil, set from Réglages. */
  .bg {
    position: fixed; inset: 0;
    background: var(--wallpaper) center / cover no-repeat, var(--veil);
  }
  /* Transparent mode: no wallpaper, the windows behind LifeOS show through the veil. */
  :global(:root[data-bg="transparent"]) .bg { background: none; }
  .bg::after { content: ""; position: absolute; inset: 0; background: color-mix(in srgb, var(--veil) var(--overlay-tint), transparent); }
  .content { flex: 1; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
  .content > :global(*) { flex: 1; min-height: 0; }
  .panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .panel.hidden { display: none; }
  footer { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 12px; flex-shrink: 0; }
</style>
