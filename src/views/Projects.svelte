<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import Icon from "../components/Icon.svelte";
  import Select from "../components/Select.svelte";
  import ProjectDialog from "../components/ProjectDialog.svelte";
  import TaskDialog, { type TaskForm } from "../components/TaskDialog.svelte";
  import EventDialog from "../components/EventDialog.svelte";
  import { app, guard, reloadNoteFolders, reloadProjects, reloadTasks, say } from "../lib/app.svelte";
  import {
    createProject, deleteProject, setProjectStatus, updateProject, addMilestone, setMilestoneDone, deleteMilestone,
    type ProjectInput,
  } from "../lib/db/projects";
  import {
    addTask, deleteTask, ensureTaskCategory, listProjectTasks, setTaskDone, setTasksStatus, updateTask, type Task,
  } from "../lib/db/tasks";
  import { createEvent, listProjectEvents, type EventInput } from "../lib/db/events";
  import { createFolder, createNote, listNotes, type NoteMeta } from "../lib/db/notes";
  import { fetchRepoCommits, type RepoCommit } from "../lib/activity/github";
  import { loadAwDay } from "../lib/activity/activitywatch";
  import { formatSeconds } from "../lib/activity/timeline";
  import { addDays, formatDay, today, toLocalDate } from "../lib/dates";
  import { formatMinutes, minutesOf, type AgendaEvent } from "../lib/agenda/agenda";
  import { priorityOf, STATUSES } from "../lib/tasks/board";
  import { onEscape } from "../lib/overlay";
  import {
    nextMilestone, overdueCount, progressOf, projectTime, PROJECT_STATUSES, sortMilestones, statusLabel,
    type Project, type ProjectStatus,
  } from "../lib/projects/projects";

  let tasks = $state<Task[]>([]);
  let filter = $state<"active" | "done">("active");
  let openId = $state<string | null>(app.openProjectId);
  let projectDialog = $state<{ project: Project | null } | null>(null);
  let taskDialog = $state<{ task: Task | null; milestoneId: string | null } | null>(null);
  let eventDialog = $state(false);

  // Time spent, last 7 days (ActivityWatch, read once).
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  type Spans = Awaited<ReturnType<typeof loadAwDay>>;
  let aw = $state<Spans | null>(null);

  const open = $derived(app.projects.find((p) => p.id === openId) ?? null);
  const shown = $derived(app.projects.filter((p) => (filter === "done") === (p.status === "done")));
  const tasksOf = (id: string) => tasks.filter((t) => t.projectId === id);
  const milestonesOf = (id: string) => sortMilestones(app.milestones.filter((m) => m.projectId === id));
  const timeOf = (p: Project) =>
    aw?.ok ? projectTime(aw.spans, p.keywords, (ms) => toLocalDate(new Date(ms))) : null;

  async function reload() {
    tasks = await listProjectTasks();
  }

  onMount(() => {
    app.openProjectId = null;
    guard(reload);
    const from = new Date(`${days[0]}T00:00:00`);
    loadAwDay(from, new Date()).then((r) => (aw = r)).catch(() => {});
    // Escape: back from a project to the list, then (App) closes the overlay.
    return onEscape(() => {
      if (!openId) return false;
      openId = null;
      return true;
    });
  });

  // `/projet <nom>` while this view is already shown.
  $effect(() => {
    if (app.openProjectId) { openId = app.openProjectId; app.openProjectId = null; }
  });

  const run = async (action: () => Promise<unknown>) => {
    await guard(async () => {
      await action();
      await Promise.all([reload(), reloadProjects(), reloadTasks()]);
    });
  };

  // ------------------------------------------------------------ project CRUD

  async function saveProject(input: ProjectInput) {
    const editing = projectDialog?.project;
    projectDialog = null;
    await run(async () => {
      if (editing) {
        await updateProject(editing.id, input);
        await loadDetail({ ...editing, ...input });
      } else {
        const notesFolder = await createFolder(input.name).catch(() => null);
        const p = await createProject({ ...input, notesFolder });
        await reloadNoteFolders();
        openId = p.id;
        say(`Projet « ${p.name} » créé. Ajoute des tâches ici ou avec /tache … +${p.slug}`, "ok");
      }
    });
  }

  async function removeProject() {
    const p = projectDialog?.project;
    projectDialog = null;
    if (!p) return;
    openId = null;
    await run(() => deleteProject(p.id));
    say(`Projet « ${p.name} » supprimé (ses tâches et rendez-vous restent, sans projet).`);
  }

  // ------------------------------------------------------------ detail data

  let notes = $state<NoteMeta[]>([]);
  let events = $state<AgendaEvent[]>([]);
  let commits = $state<RepoCommit[] | { error: string } | null>(null);
  let newMilestone = $state("");
  let newMilestoneDate = $state("");
  let newNote = $state("");

  async function loadDetail(p: Project) {
    const [allNotes, evs] = await Promise.all([listNotes(), listProjectEvents(p.id, today())]);
    notes = p.notesFolder ? allNotes.filter((n) => n.folder === p.notesFolder) : [];
    events = evs;
    commits = null;
    if (p.repo) {
      fetchRepoCommits(p.repo).then((c) => (commits = c)).catch((e) => (commits = { error: String(e.message ?? e) }));
    }
  }

  // Load the detail when another project opens (not on every data reload).
  $effect(() => {
    const id = openId;
    if (!id) return;
    untrack(() => {
      const p = app.projects.find((x) => x.id === id);
      if (p) guard(() => loadDetail(p));
    });
  });

  const detailTasks = $derived(open ? tasksOf(open.id) : []);
  const detailMilestones = $derived(open ? milestonesOf(open.id) : []);
  const dueTasks = $derived(
    detailTasks.filter((t) => t.status !== "done" && t.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 6),
  );
  const openTime = $derived(open ? timeOf(open) : null);
  const maxDay = $derived(openTime ? Math.max(1, ...days.map((d) => openTime.byDay[d] ?? 0)) : 1);

  async function addMs(e: SubmitEvent) {
    e.preventDefault();
    if (!open || !newMilestone.trim()) return;
    const [title, due] = [newMilestone, newMilestoneDate || null];
    newMilestone = "";
    newMilestoneDate = "";
    await run(() => addMilestone(open.id, title, due));
  }

  async function addNote(e: SubmitEvent) {
    e.preventDefault();
    if (!open || !newNote.trim()) return;
    const p = open;
    const title = newNote.trim();
    newNote = "";
    await guard(async () => {
      let folder = p.notesFolder;
      if (!folder) {
        folder = await createFolder(p.name);
        await updateProject(p.id, { ...p, notesFolder: folder });
        await reloadProjects();
      }
      const note = await createNote(title, folder);
      await reloadNoteFolders();
      app.openNoteId = note.id;
      app.view = "notes";
    });
  }

  function openNote(id: string) {
    app.openNoteId = id;
    app.view = "notes";
  }

  function openKanban(p: Project) {
    app.taskProjectFilter = p.id;
    app.view = "tasks";
  }

  function openClaude(p: Project) {
    if (!p.folder) return;
    app.claude.request = p.folder;
    app.view = "claude";
  }

  async function saveTask(f: TaskForm) {
    const t = taskDialog?.task;
    taskDialog = null;
    await run(async () => {
      const categoryId = f.newCategory ? await ensureTaskCategory(f.newCategory) : f.categoryId;
      if (t) {
        await updateTask(t.id, {
          title: f.title, dueDate: f.dueDate, categoryId, priority: f.priority, projectId: f.projectId, milestoneId: f.milestoneId,
        });
        if (f.status !== t.status) await setTasksStatus([t.id], f.status);
      } else {
        await addTask({
          title: f.title, dueDate: f.dueDate, categoryId, priority: f.priority, status: f.status,
          projectId: f.projectId, milestoneId: f.milestoneId,
        });
      }
    });
  }

  async function saveEvent(e: EventInput) {
    eventDialog = false;
    await guard(async () => {
      await createEvent(e);
      app.agendaVersion++;
      if (open) events = await listProjectEvents(open.id, today());
      say("Rendez-vous ajouté.", "ok");
    });
  }

  const eventWhen = (e: AgendaEvent) => `${formatDay(e.day)}${e.startAt ? ` · ${formatMinutes(minutesOf(e.startAt))}` : ""}`;
  const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
</script>

{#if !open}
  <!-- ------------------------------------------------------------ list -->
  <section class="list">
    <div class="toolbar glass">
      <div class="seg" role="group" aria-label="Filtre">
        <button class:on={filter === "active"} onclick={() => (filter = "active")}>En cours</button>
        <button class:on={filter === "done"} onclick={() => (filter = "done")}>Finis</button>
      </div>
      <span class="grow"></span>
      <button class="primary" onclick={() => (projectDialog = { project: null })}><Icon name="plus" size={15} /> Nouveau projet</button>
    </div>

    {#if shown.length === 0}
      <div class="empty glass">
        <Icon name="briefcase" size={28} />
        <p>{filter === "done" ? "Aucun projet fini pour l'instant." : "Aucun projet. Crée-en un, ou tape /projet LifeOS."}</p>
        {#if filter === "active"}
          <button class="primary" onclick={() => (projectDialog = { project: null })}><Icon name="plus" size={15} /> Nouveau projet</button>
        {/if}
      </div>
    {:else}
      <div class="cards">
        {#each shown as p, i (p.id)}
          {@const pt = tasksOf(p.id)}
          {@const prog = progressOf(pt)}
          {@const late = overdueCount(pt, today())}
          {@const next = nextMilestone(milestonesOf(p.id))}
          {@const time = timeOf(p)}
          <button class="card glass anim-rise" style:animation-delay="{i * 40}ms" onclick={() => (openId = p.id)}>
            <span class="head">
              <span class="pic" style:background={p.color}>{#if p.icon}<Icon name={p.icon} size={16} />{/if}</span>
              <span class="pname">{p.name}</span>
              <span class="status s-{p.status}">{statusLabel(p.status)}</span>
            </span>
            {#if p.description}<span class="desc">{p.description}</span>{/if}
            <span class="bar"><span style:width="{prog.pct}%" style:background={p.color}></span></span>
            <span class="meta">
              <span>{prog.done}/{prog.total} tâches · {prog.pct} %</span>
              {#if late}<span class="late"><Icon name="alarm-clock" size={12} /> {late} en retard</span>{/if}
              {#if time && time.total > 0}<span><Icon name="activity" size={12} /> {formatSeconds(time.total)} / 7 j</span>{/if}
            </span>
            {#if next || p.dueDate}
              <span class="meta">
                {#if next}<span><Icon name="flag" size={12} /> {next.title}{next.dueDate ? ` · ${formatDay(next.dueDate)}` : ""}</span>{/if}
                {#if p.dueDate}<span><Icon name="calendar" size={12} /> {formatDay(p.dueDate)}</span>{/if}
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </section>
{:else}
  <!-- ------------------------------------------------------------ detail -->
  {@const prog = progressOf(detailTasks)}
  {@const late = overdueCount(detailTasks, today())}
  <section class="detail">
    <div class="toolbar glass">
      <button class="icon-btn" onclick={() => (openId = null)} title="Retour (Échap)" aria-label="Retour"><Icon name="chevron-left" /></button>
      <span class="pic big" style:background={open.color}>{#if open.icon}<Icon name={open.icon} size={18} />{/if}</span>
      <div class="titles">
        <h2>{open.name}</h2>
        <span class="sub">+{open.slug}{open.dueDate ? ` · échéance ${formatDay(open.dueDate)}` : ""}</span>
      </div>
      <Select label="Statut" value={open.status} onchange={(v) => run(() => setProjectStatus(open.id, v as ProjectStatus))}
        options={PROJECT_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
      <span class="grow"></span>
      {#if open.folder}
        <button onclick={() => openClaude(open)} title="Ouvrir Claude dans {open.folder}"><Icon name="square-terminal" size={15} /> Claude</button>
      {/if}
      <button onclick={() => openKanban(open)} title="Kanban filtré sur ce projet"><Icon name="list-checks" size={15} /> Kanban</button>
      <button onclick={() => (projectDialog = { project: open })}><Icon name="settings" size={15} /> Modifier</button>
    </div>

    <div class="cols">
      <div class="col">
        <div class="panel glass">
          <div class="ph">
            <h3>Avancement</h3>
            <span class="muted">{prog.done}/{prog.total} tâches{late ? ` · ${late} en retard` : ""}</span>
          </div>
          <div class="bar big"><span style:width="{prog.pct}%" style:background={open.color}></span></div>
          {#if open.description}<p class="desc">{open.description}</p>{/if}
        </div>

        <div class="panel glass">
          <div class="ph"><h3>Jalons</h3></div>
          {#if detailMilestones.length === 0}<p class="muted small">Découpe le projet en étapes datées (ex. V1, rendu, mise en ligne).</p>{/if}
          <ul class="ms">
            {#each detailMilestones as m (m.id)}
              {@const mp = progressOf(detailTasks.filter((t) => t.milestoneId === m.id))}
              <li class:done={!!m.doneAt}>
                <input type="checkbox" checked={!!m.doneAt} onchange={(e) => run(() => setMilestoneDone(m.id, e.currentTarget.checked))}
                  aria-label="Jalon atteint" />
                <span class="mt">{m.title}</span>
                {#if mp.total}<span class="mini-bar"><span style:width="{mp.pct}%" style:background={open.color}></span></span>{/if}
                {#if m.dueDate}<span class="when" class:late={!m.doneAt && m.dueDate < today()}>{formatDay(m.dueDate)}</span>{/if}
                <button class="icon-btn add" onclick={() => (taskDialog = { task: null, milestoneId: m.id })} title="Tâche dans ce jalon" aria-label="Ajouter une tâche au jalon">
                  <Icon name="plus" size={13} />
                </button>
                <button class="icon-btn del" onclick={() => run(() => deleteMilestone(m.id))} title="Supprimer le jalon" aria-label="Supprimer le jalon">
                  <Icon name="x" size={13} />
                </button>
              </li>
            {/each}
          </ul>
          <form class="inline" onsubmit={addMs}>
            <input bind:value={newMilestone} placeholder="Nouveau jalon…" aria-label="Nouveau jalon" />
            <input type="date" bind:value={newMilestoneDate} aria-label="Date du jalon" />
            <button type="submit" disabled={!newMilestone.trim()}><Icon name="plus" size={14} /></button>
          </form>
        </div>

        <div class="panel glass grow-panel">
          <div class="ph">
            <h3>Tâches</h3>
            <button class="small-btn" onclick={() => (taskDialog = { task: null, milestoneId: null })}><Icon name="plus" size={13} /> Tâche</button>
          </div>
          {#if detailTasks.length === 0}<p class="muted small">Aucune tâche. Ou depuis la barre : <code>/tache … +{open.slug}</code></p>{/if}
          {#each STATUSES as s (s.id)}
            {@const list = detailTasks.filter((t) => t.status === s.id)}
            {#if list.length}
              <p class="group">{s.label} <span class="muted">{list.length}</span></p>
              <ul class="tasks">
                {#each list as t (t.id)}
                  {@const ms = app.milestones.find((m) => m.id === t.milestoneId)}
                  <li class:done={t.status === "done"}>
                    <input type="checkbox" checked={t.status === "done"} onchange={(e) => run(() => setTaskDone(t.id, e.currentTarget.checked))} aria-label="Faite" />
                    <span class="pdot" style:background={priorityOf(t.priority).color}></span>
                    <button class="tt" onclick={() => (taskDialog = { task: t, milestoneId: null })}>{t.title}</button>
                    {#if ms}<span class="tag">{ms.title}</span>{/if}
                    {#if t.dueDate}<span class="when" class:late={t.status !== "done" && t.dueDate < today()}>{formatDay(t.dueDate)}</span>{/if}
                  </li>
                {/each}
              </ul>
            {/if}
          {/each}
        </div>
      </div>

      <div class="col">
        <div class="panel glass">
          <div class="ph"><h3>Temps passé · 7 jours</h3>{#if openTime}<span class="accent">{formatSeconds(openTime.total)}</span>{/if}</div>
          {#if aw === null}
            <p class="muted small">Chargement…</p>
          {:else if !aw.ok}
            <p class="muted small">ActivityWatch indisponible.</p>
          {:else if open.keywords.length === 0}
            <p class="muted small">Ajoute des mots-clés au projet (Modifier) pour compter son temps.</p>
          {:else}
            <div class="days">
              {#each days as d (d)}
                {@const sec = openTime?.byDay[d] ?? 0}
                <div class="day" title="{formatDay(d)} : {formatSeconds(sec)}">
                  <span class="dbar"><span style:height="{(sec / maxDay) * 100}%" style:background={open.color}></span></span>
                  <span class="dl">{DAY_LETTERS[new Date(`${d}T12:00:00`).getDay()]}</span>
                </div>
              {/each}
            </div>
            <p class="muted small">Mots-clés : {open.keywords.join(", ")}</p>
          {/if}
        </div>

        <div class="panel glass">
          <div class="ph">
            <h3>Agenda</h3>
            <button class="small-btn" onclick={() => (eventDialog = true)}><Icon name="plus" size={13} /> Rendez-vous</button>
          </div>
          {#if events.length === 0 && dueTasks.length === 0}<p class="muted small">Rien de prévu. <code>/rdv … +{open.slug}</code></p>{/if}
          <ul class="agenda">
            {#each events as e (e.id)}
              <li><Icon name={e.kind === "memo" ? "pin" : "calendar"} size={13} /><span class="tt-s">{e.title}</span><span class="when">{eventWhen(e)}</span></li>
            {/each}
            {#each dueTasks as t (t.id)}
              <li><Icon name="alarm-clock" size={13} /><span class="tt-s">{t.title}</span>
                <span class="when" class:late={t.dueDate! < today()}>{formatDay(t.dueDate!)}</span></li>
            {/each}
          </ul>
        </div>

        <div class="panel glass">
          <div class="ph"><h3>Notes</h3>{#if open.notesFolder}<span class="muted small">dossier « {open.notesFolder} »</span>{/if}</div>
          <ul class="notes">
            {#each notes as n (n.id)}
              <li><button class="tt" onclick={() => openNote(n.id)}><Icon name="file-text" size={13} /> {n.title}</button></li>
            {/each}
          </ul>
          <form class="inline" onsubmit={addNote}>
            <input bind:value={newNote} placeholder="Nouvelle note (titre)…" aria-label="Nouvelle note" />
            <button type="submit" disabled={!newNote.trim()}><Icon name="plus" size={14} /></button>
          </form>
        </div>

        <div class="panel glass">
          <div class="ph"><h3>GitHub</h3>{#if open.repo}<span class="muted small">{open.repo}</span>{/if}</div>
          {#if !open.repo}
            <p class="muted small">Lie un dépôt au projet (Modifier) pour voir ses derniers commits.</p>
          {:else if commits === null}
            <p class="muted small">Chargement…</p>
          {:else if "error" in commits}
            <p class="err small">{commits.error}</p>
          {:else if commits.length === 0}
            <p class="muted small">Aucun commit.</p>
          {:else}
            <ul class="commits">
              {#each commits as c (c.sha)}
                <li>
                  <button class="tt" onclick={() => openUrl(c.url)} title="Ouvrir sur GitHub">
                    <code>{c.sha}</code> <span class="tt-s">{c.message}</span>
                  </button>
                  <span class="when">{c.date ? formatDay(c.date.slice(0, 10)) : ""}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  </section>
{/if}

{#if projectDialog}
  <ProjectDialog project={projectDialog.project} onsave={saveProject}
    ondelete={projectDialog.project ? removeProject : undefined} oncancel={() => (projectDialog = null)} />
{/if}
{#if taskDialog && open}
  <TaskDialog task={taskDialog.task} defaultProjectId={open.id} defaultMilestoneId={taskDialog.milestoneId}
    onsave={saveTask}
    ondelete={taskDialog.task ? () => { const id = taskDialog!.task!.id; taskDialog = null; run(() => deleteTask(id)); } : undefined}
    oncancel={() => (taskDialog = null)} />
{/if}
{#if eventDialog && open}
  <EventDialog initial={{ kind: "event", day: today(), start: 9 * 60, end: 10 * 60, projectId: open.id }}
    onsave={saveEvent} oncancel={() => (eventDialog = false)} />
{/if}

<style>
  section { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 0; max-width: 1400px; width: 100%; margin: 0 auto; }
  .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--radius); }
  .grow { flex: 1; }
  button {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font: inherit; font-size: 14px;
  }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: var(--accent); color: var(--on-accent); border-color: transparent; font-weight: 600; }
  .seg { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button { border: none; border-radius: 0; background: transparent; color: var(--text-muted); }
  .seg button.on { background: var(--surface-strong); color: var(--text); }
  .icon-btn { padding: 5px; border-color: transparent; background: none; color: var(--text-muted); }
  .icon-btn:hover { color: var(--text); background: var(--surface); }
  .muted { color: var(--text-muted); }
  .small { font-size: 13px; }
  .err { color: var(--error); }
  .accent { color: var(--accent); font-weight: 600; }
  code { font-family: var(--mono); font-size: 12px; }

  /* list */
  .empty {
    display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px; margin: auto;
    border-radius: var(--radius); color: var(--text-muted); text-align: center;
  }
  .cards {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
    overflow: auto; min-height: 0; padding: 2px; align-content: start;
  }
  .card {
    flex-direction: column; align-items: stretch; gap: 10px; padding: 16px; text-align: left;
    border-radius: var(--radius); font-size: 13px;
  }
  .card:hover { transform: translateY(-2px); }
  .head { display: flex; align-items: center; gap: 10px; }
  .pic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: #fff; flex-shrink: 0; }
  .pic.big { width: 38px; height: 38px; border-radius: 10px; }
  .pname { flex: 1; font-size: 16px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--surface-strong); color: var(--text-muted); }
  .status.s-active { color: var(--ok); }
  .status.s-paused { color: var(--warn); }
  .desc { color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0; }
  .bar { display: block; height: 6px; border-radius: 3px; background: var(--surface-strong); overflow: hidden; }
  .bar.big { height: 8px; margin: 4px 0; }
  .bar span, .mini-bar span { display: block; height: 100%; border-radius: inherit; transition: width 400ms var(--ease); }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--text-muted); }
  .meta span { display: inline-flex; align-items: center; gap: 4px; }
  .late { color: var(--error) !important; }

  /* detail */
  .titles { display: flex; flex-direction: column; }
  .titles h2 { margin: 0; font-size: 18px; }
  .sub { color: var(--text-muted); font-size: 12px; font-family: var(--mono); }
  .cols { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; flex: 1; min-height: 0; }
  .col { display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow: auto; padding: 2px; }
  .panel { padding: 14px 16px; border-radius: var(--radius); }
  .grow-panel { flex: 1; }
  .ph { display: flex; align-items: center; gap: 10px; justify-content: space-between; margin-bottom: 8px; }
  h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .small-btn { padding: 3px 10px; font-size: 13px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  li { display: flex; align-items: center; gap: 8px; min-width: 0; }
  li input[type="checkbox"] { accent-color: var(--accent); width: 16px; height: 16px; flex-shrink: 0; }
  .ms li, .tasks li { padding: 6px 8px; border-radius: 8px; background: var(--surface); }
  .ms li.done .mt, .tasks li.done .tt { text-decoration: line-through; color: var(--text-muted); }
  .mt { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mini-bar { display: block; width: 60px; height: 5px; border-radius: 3px; background: var(--surface-strong); overflow: hidden; flex-shrink: 0; }
  .ms .icon-btn { opacity: 0; padding: 3px; }
  .ms li:hover .icon-btn { opacity: 1; }
  .ms .del:hover { color: var(--error); }
  .when { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
  .group { margin: 10px 0 4px; font-size: 12px; font-weight: 600; color: var(--text-muted); }
  .pdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tt {
    flex: 1; min-width: 0; justify-content: flex-start; background: none; border: none; padding: 0; color: var(--text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
  }
  .tt:hover { color: var(--accent); }
  .tt-s { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--surface-strong); color: var(--text-muted); white-space: nowrap; }
  .agenda li, .notes li, .commits li { padding: 4px 2px; color: var(--text-muted); }
  .agenda li .tt-s, .commits .tt-s { color: var(--text); }
  .inline { display: flex; gap: 6px; margin-top: 8px; }
  .inline input {
    flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 10px; color: var(--text); font: inherit; font-size: 13px; outline: none; color-scheme: inherit;
  }
  .inline input[type="date"] { flex: 0 0 140px; }
  .inline input:focus { border-color: var(--accent); }
  .inline button { padding: 6px 9px; }
  .days { display: flex; gap: 8px; align-items: flex-end; height: 90px; margin: 6px 0 8px; }
  .day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
  .dbar { flex: 1; width: 100%; max-width: 28px; display: flex; align-items: flex-end; background: var(--surface); border-radius: 6px; overflow: hidden; }
  .dbar span { display: block; width: 100%; border-radius: 6px; transition: height 400ms var(--ease); }
  .dl { font-size: 11px; color: var(--text-muted); }
</style>
