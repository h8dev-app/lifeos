<script lang="ts">
  import { onDestroy } from "svelte";
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import Icon from "./Icon.svelte";
  import RecentEntries from "./RecentEntries.svelte";
  import TaskList from "./TaskList.svelte";
  import Streaks from "./Streaks.svelte";
  import ActivitySummary from "./ActivitySummary.svelte";
  import AgendaToday from "./AgendaToday.svelte";
  import { app, guard, reloadEntries, say } from "../lib/app.svelte";
  import { deleteEntry, listRecentEntries, type RecentEntry } from "../lib/db/entries";
  import { listProjectTasks, type Task } from "../lib/db/tasks";
  import { listNotes, readNoteBody, type NoteMeta } from "../lib/db/notes";
  import { formatDate, formatTime } from "../lib/clock";
  import { formatDay, startOfDayIso, today } from "../lib/dates";
  import { blockTitle, type Block, type BlockOptions } from "../lib/dashboard/layout";
  import { nextMilestone, progressOf, sortMilestones } from "../lib/projects/projects";

  // Content of one home block, also shown alone in a screen widget.
  // The parent must be a size container (container-type: size) for the clock.
  let { block, hideTitle = false, editable = true, onoptions }: {
    block: Block;
    /** The screen widget shows the title in its own header. */
    hideTitle?: boolean;
    /** Post-it text can be typed (not in a screen widget: only the main window saves). */
    editable?: boolean;
    onoptions?: (options: BlockOptions) => void;
  } = $props();

  const o = $derived(block.options);
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");

  // ------------------------------------------------------------ clock
  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));
  const seconds = $derived(o.seconds === true);

  // ------------------------------------------------------------ tasks
  const tasks = $derived.by(() => {
    if (block.type !== "tasks") return [];
    const t = today(now);
    let list = app.tasks;
    const scope = str("scope") || "today";
    if (scope === "today") {
      list = list.filter((x) => (x.doneAt ? x.doneAt >= startOfDayIso(now) : !x.plannedFor || x.plannedFor <= t));
    } else if (scope === "open") {
      list = list.filter((x) => x.status !== "done");
    } else if (scope === "overdue") {
      list = list.filter((x) => x.status !== "done" && x.dueDate !== null && x.dueDate < t);
    }
    if (str("project")) list = list.filter((x) => x.projectId === str("project"));
    if (str("category")) list = list.filter((x) => x.categoryId === str("category"));
    return [...list].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || a.priority - b.priority);
  });
  const tasksEmpty = $derived(
    str("scope") === "overdue" ? "Aucune tâche en retard." : str("scope") === "open" ? "Rien à faire." : "Aucune tâche aujourd'hui.",
  );

  // ------------------------------------------------------------ projects
  let projectTasks = $state<Task[]>([]);
  $effect(() => {
    if (block.type !== "project" && block.type !== "projects") return;
    void app.tasks; // reload when tasks change
    const id = block.type === "project" ? str("project") : undefined;
    if (block.type === "project" && !id) return;
    guard(() => listProjectTasks(id)).then((l) => (projectTasks = l ?? []));
  });
  const project = $derived(block.type === "project" ? app.projects.find((p) => p.id === str("project")) : undefined);
  const activeProjects = $derived(app.projects.filter((p) => p.status === "active"));

  function openProject(id: string) {
    app.openProjectId = id;
    app.view = "projects";
  }

  // ------------------------------------------------------------ notes
  let notes = $state<NoteMeta[]>([]);
  let pinned = $state<{ title: string; html: string } | null | undefined>(undefined);
  $effect(() => {
    void app.agendaVersion; // bumped by the screen widgets' refresh
    if (block.type === "notes") {
      const folder = str("folder");
      guard(() => listNotes()).then((l) => (notes = (l ?? []).filter((n) => !folder || n.folder === folder).slice(0, 12)));
    } else if (block.type === "note") {
      const id = str("note");
      if (!id) { pinned = null; return; }
      guard(() => readNoteBody(id)).then((n) => {
        pinned = n ? { title: n.title, html: DOMPurify.sanitize(marked.parse(n.body, { async: false })) } : null;
      });
    }
  });

  function openNote(id: string) {
    app.openNoteId = id;
    app.view = "notes";
  }

  // ------------------------------------------------------------ habits
  let entries = $state<RecentEntry[]>([]);
  $effect(() => {
    if (block.type !== "entries") return;
    const cat = str("category");
    void app.recent; // reload after a new entry
    guard(() => listRecentEntries(cat ? 60 : 12)).then((l) => (entries = (l ?? []).filter((e) => !cat || e.categoryId === cat).slice(0, 12)));
  });

  async function remove(entryId: string) {
    await guard(async () => {
      await deleteEntry(entryId);
      await reloadEntries();
      say("Entrée supprimée.");
    });
  }

  // ------------------------------------------------------------ post-it
  let memoTimer: ReturnType<typeof setTimeout> | undefined;
  function typeMemo(text: string) {
    clearTimeout(memoTimer);
    memoTimer = setTimeout(() => onoptions?.({ ...block.options, text }), 500);
  }
</script>

{#if !hideTitle && block.type !== "clock"}
  <h2 class="btitle">{blockTitle(block)}</h2>
{/if}

{#if block.type === "clock"}
  <div class="clock">
    <div class="time">{formatTime(now)}{#if seconds}<span class="sec">:{String(now.getSeconds()).padStart(2, "0")}</span>{/if}</div>
    <div class="date">{formatDate(now)}</div>
  </div>
{:else if block.type === "agenda"}
  <AgendaToday range={str("range") || "today"} bare />
{:else if block.type === "tasks"}
  {#if tasks.length}<TaskList {tasks} compact />{:else}<p class="empty">{tasksEmpty}</p>{/if}
{:else if block.type === "project"}
  {#if !project}
    <p class="empty">Choisis un projet dans les réglages du bloc.</p>
  {:else}
    {@const prog = progressOf(projectTasks)}
    {@const next = nextMilestone(sortMilestones(app.milestones.filter((m) => m.projectId === project.id)))}
    <button class="phead" onclick={() => openProject(project.id)}>
      <span class="pic" style:background={project.color}>{#if project.icon}<Icon name={project.icon} size={14} />{/if}</span>
      <span class="pname">{project.name}</span>
      <span class="muted">{prog.pct} %</span>
    </button>
    <span class="bar"><span style:width="{prog.pct}%" style:background={project.color}></span></span>
    <p class="muted small">{prog.done}/{prog.total} tâches{next ? ` · prochain jalon : ${next.title}${next.dueDate ? ` (${formatDay(next.dueDate)})` : ""}` : ""}</p>
    {@const open = projectTasks.filter((t) => t.status !== "done").sort((a, b) => a.priority - b.priority).slice(0, 6)}
    {#if open.length}<TaskList tasks={open} compact />{/if}
  {/if}
{:else if block.type === "projects"}
  {#if activeProjects.length === 0}
    <p class="empty">Aucun projet en cours. <code>/projet …</code></p>
  {:else}
    <ul class="plist">
      {#each activeProjects as p (p.id)}
        {@const prog = progressOf(projectTasks.filter((t) => t.projectId === p.id))}
        <li>
          <button class="phead" onclick={() => openProject(p.id)}>
            <span class="pic" style:background={p.color}>{#if p.icon}<Icon name={p.icon} size={13} />{/if}</span>
            <span class="pname">{p.name}</span>
            <span class="muted">{prog.done}/{prog.total}</span>
          </button>
          <span class="bar"><span style:width="{prog.pct}%" style:background={p.color}></span></span>
        </li>
      {/each}
    </ul>
  {/if}
{:else if block.type === "notes"}
  {#if notes.length === 0}
    <p class="empty">Aucune note{str("folder") ? ` dans « ${str("folder")} »` : ""}.</p>
  {:else}
    <ul class="nlist">
      {#each notes as n (n.id)}
        <li><button onclick={() => openNote(n.id)}><Icon name="file-text" size={13} /><span>{n.title}</span></button></li>
      {/each}
    </ul>
  {/if}
{:else if block.type === "note"}
  {#if pinned === null}
    <p class="empty">Choisis une note dans les réglages du bloc.</p>
  {:else if pinned}
    <!-- Sanitized with DOMPurify. -->
    <div class="md">{@html pinned.html}</div>
  {/if}
{:else if block.type === "memo"}
  {#if editable}
    <textarea class="memo" placeholder="Écris ici…" value={str("text")} oninput={(e) => typeMemo(e.currentTarget.value)}></textarea>
  {:else}
    <p class="memo-ro">{str("text") || "Post-it vide."}</p>
  {/if}
{:else if block.type === "streaks"}
  {#if app.streaks.length}<Streaks />{:else}<p class="empty">Aucune série. Enregistre une habitude deux jours de suite.</p>{/if}
{:else if block.type === "entries"}
  <RecentEntries {entries} categories={app.categories} ondelete={remove} bare />
{:else if block.type === "activity"}
  <ActivitySummary bare />
{/if}

<style>
  .btitle { font-size: 13px; font-weight: 600; color: var(--text-muted); margin: 12px 0 10px; padding-right: 56px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .clock { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .time { font-size: clamp(24px, min(40cqh, 18cqw), 96px); font-weight: 200; letter-spacing: 2px; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .sec { font-size: 0.45em; color: var(--text-muted); }
  .date { color: var(--text-muted); font-size: clamp(12px, 10cqh, 18px); }
  .empty, .muted { color: var(--text-muted); }
  .small { font-size: 12px; margin: 6px 0 10px; }
  code { font-family: var(--mono); color: var(--text); }
  button { background: none; border: none; padding: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
  .phead { display: flex; align-items: center; gap: 8px; width: 100%; }
  .phead:hover .pname { color: var(--accent); }
  .pic { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: #fff; flex-shrink: 0; }
  .pname { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { display: block; height: 6px; border-radius: 3px; background: var(--surface-strong); overflow: hidden; margin-top: 8px; }
  .bar span { display: block; height: 100%; border-radius: inherit; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .plist li { padding: 8px 10px; background: var(--surface); border-radius: 8px; }
  .plist .bar { margin-top: 6px; height: 4px; }
  .nlist button {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: 8px; background: var(--surface);
  }
  .nlist button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nlist button:hover { color: var(--accent); }
  .md { font-size: 14px; line-height: 1.5; }
  .md :global(h1) { font-size: 18px; margin: 0 0 8px; }
  .md :global(h2) { font-size: 15px; margin: 12px 0 6px; }
  .md :global(h3) { font-size: 14px; margin: 10px 0 4px; }
  .md :global(p), .md :global(ul), .md :global(ol) { margin: 0 0 8px; }
  .md :global(ul), .md :global(ol) { padding-left: 20px; }
  .md :global(code) { font-family: var(--mono); font-size: 12px; background: var(--surface); padding: 1px 4px; border-radius: 4px; }
  .md :global(a) { color: var(--accent); }
  .memo {
    width: 100%; height: calc(100% - 4px); min-height: 60px; resize: none; border: none; outline: none; background: none;
    color: var(--text); font: inherit; font-size: 15px; line-height: 1.5;
  }
  .memo-ro { margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 1.5; }
</style>
