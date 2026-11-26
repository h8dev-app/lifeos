<script lang="ts">
  import { onMount } from "svelte";
  import EventDialog from "../components/EventDialog.svelte";
  import { app, guard, reloadTasks, say } from "../lib/app.svelte";
  import {
    atMinutes, formatMinutes, layoutDay, minutesOf, monthGrid, snapMinutes, weekDays,
    type AgendaEvent, type EventKind,
  } from "../lib/agenda/agenda";
  import {
    createEvent, deleteEvent, listEvents, listNotesTouchedBetween, listTasksDueBetween, moveEvent,
    setEventNote, updateEvent, type EventInput,
  } from "../lib/db/events";
  import { listEntriesBetween, type RecentEntry } from "../lib/db/entries";
  import { setTaskDone } from "../lib/db/tasks";
  import { createFolder, createNote } from "../lib/db/notes";
  import { addDays, today, toLocalDate } from "../lib/dates";
  import { formatEntryData } from "../lib/format";
  import { priorityOf } from "../lib/tasks/board";

  const HOUR_PX = 48;
  const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  let mode = $state<"week" | "month">("week");
  let anchor = $state(today()); // a day inside the shown week/month
  let events = $state<AgendaEvent[]>([]);
  let tasks = $state<{ id: string; title: string; due_date: string; status: string; priority: number }[]>([]);
  let notes = $state<{ id: string; title: string | null; day: string }[]>([]);
  let entries = $state<RecentEntry[]>([]);
  let dialog = $state<{ event: AgendaEvent | null; initial: { kind: EventKind; day: string; start: number | null; end: number | null } } | null>(null);
  let dropDay = $state<string | null>(null);
  let now = $state(new Date());
  let grid: HTMLDivElement | undefined = $state();

  const week = $derived(weekDays(anchor));
  const month = $derived(monthGrid(anchor));
  const range = $derived(mode === "week" ? [week[0], week[6]] : [month[0][0], month[5][6]]);
  const t = $derived(toLocalDate(now));

  const title = $derived.by(() => {
    if (mode === "month") {
      const [y, m] = anchor.split("-").map(Number);
      const s = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    const f = (d: string, opts: Intl.DateTimeFormatOptions) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString("fr-FR", opts); };
    return `${f(week[0], { day: "numeric", month: "short" })} – ${f(week[6], { day: "numeric", month: "short", year: "numeric" })}`;
  });

  async function load() {
    const [from, to] = range;
    const fromIso = new Date(from + "T00:00").toISOString();
    const toIso = new Date(addDays(to, 1) + "T00:00").toISOString();
    const [ev, tk, nt, en] = await Promise.all([
      guard(() => listEvents(from, to)),
      guard(() => listTasksDueBetween(from, to)),
      guard(() => listNotesTouchedBetween(fromIso, toIso)),
      guard(() => listEntriesBetween(fromIso, toIso)),
    ]);
    events = ev ?? [];
    tasks = tk ?? [];
    notes = (nt ?? []).map((n) => ({ id: n.id, title: n.title, day: toLocalDate(new Date(n.updated_at)) }));
    entries = en ?? [];
  }

  // Reload when the range changes or when data changes elsewhere.
  $effect(() => { range; app.tasks; app.recent; app.agendaVersion; load(); });

  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(timer);
  });

  // Scroll the hour grid to 7:00 (or just before now) when it appears.
  $effect(() => {
    if (mode === "week" && grid) {
      const h = week.includes(t) ? Math.max(0, now.getHours() - 2) : 7;
      grid.scrollTop = h * HOUR_PX;
    }
  });

  function shift(step: number) {
    if (mode === "week") anchor = addDays(anchor, 7 * step);
    else {
      const [y, m] = anchor.split("-").map(Number);
      anchor = toLocalDate(new Date(y, m - 1 + step, 1));
    }
  }

  // ----- per-day content
  const timedOf = (day: string) => events.filter((e) => e.day === day && !e.allDay && e.startAt);
  const allDayOf = (day: string) => events.filter((e) => e.day === day && (e.allDay || !e.startAt));
  const tasksOf = (day: string) => tasks.filter((x) => x.due_date === day);
  const notesOf = (day: string) => notes.filter((n) => n.day === day);
  const entriesOf = (day: string) => entries.filter((e) => toLocalDate(new Date(e.occurredAt)) === day);
  const catOf = (id: string) => app.categories.find((c) => c.id === id);

  function placed(day: string) {
    return layoutDay(timedOf(day).map((e) => {
      const start = minutesOf(e.startAt!);
      const end = e.endAt ? minutesOf(e.endAt) : start + (e.kind === "memo" ? 20 : 60);
      return { item: e, start, end };
    }));
  }

  const dayLabel = (d: string, i: number) => `${DAY_NAMES[i]} ${Number(d.slice(8))}`;

  // ----- dialog
  function openNew(kind: EventKind, day = week.includes(t) || mode === "month" ? t : anchor, start: number | null = kind === "event" ? 9 * 60 : null) {
    dialog = { event: null, initial: { kind, day, start, end: start === null ? null : start + 60 } };
  }

  function slotClick(e: MouseEvent, day: string) {
    if ((e.target as HTMLElement).closest(".event")) return;
    const y = e.offsetY;
    const start = snapMinutes((y / HOUR_PX) * 60, 30);
    dialog = { event: null, initial: { kind: "event", day, start, end: start + 60 } };
  }

  async function save(input: EventInput) {
    const ev = dialog?.event;
    dialog = null;
    await guard(async () => {
      if (ev) await updateEvent(ev.id, input);
      else await createEvent(input);
    });
    say(`✓ ${input.kind === "memo" ? "Pense-bête" : "Rendez-vous"} enregistré.`, "ok");
    await load();
  }

  async function remove() {
    const ev = dialog?.event;
    dialog = null;
    if (ev) await guard(() => deleteEvent(ev.id));
    await load();
  }

  /** Linked note: created in the "Agenda" category the first time, then opened. */
  async function openNote() {
    const ev = dialog?.event;
    if (!ev) return;
    dialog = null;
    let noteId = ev.noteId;
    if (!noteId) {
      const [y, m, d] = ev.day.split("-").map(Number);
      const date = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      const note = await guard(async () => {
        await createFolder("Agenda");
        return createNote(`${ev.title} (${date})`, "Agenda");
      });
      if (!note) return;
      noteId = note.id;
      await guard(() => setEventNote(ev.id, note.id));
    }
    app.openNoteId = noteId;
    app.view = "notes";
  }

  function openNoteById(id: string) {
    app.openNoteId = id;
    app.view = "notes";
  }

  async function toggleTask(id: string, done: boolean) {
    await guard(() => setTaskDone(id, done));
    await reloadTasks();
  }

  // ----- drag and drop (week view)
  let grab = 0; // minutes between the event top and the mouse

  function dragStart(e: DragEvent, ev: AgendaEvent) {
    if (ev.startAt) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      grab = ((e.clientY - rect.top) / HOUR_PX) * 60;
    } else grab = 0;
    e.dataTransfer?.setData("text/plain", ev.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  async function dropOnHours(e: DragEvent, day: string) {
    e.preventDefault();
    dropDay = null;
    const ev = events.find((x) => x.id === e.dataTransfer?.getData("text/plain"));
    if (!ev) return;
    const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const start = snapMinutes(((e.clientY - col.top) / HOUR_PX) * 60 - grab);
    const duration = ev.startAt && ev.endAt ? minutesOf(ev.endAt) - minutesOf(ev.startAt) : ev.kind === "event" ? 60 : 0;
    const end = Math.min(start + duration, 24 * 60 - 1);
    await guard(() => moveEvent(ev.id, day, atMinutes(day, start), duration > 0 ? atMinutes(day, end) : null));
    await load();
  }

  async function dropOnAllDay(e: DragEvent, day: string) {
    e.preventDefault();
    dropDay = null;
    const ev = events.find((x) => x.id === e.dataTransfer?.getData("text/plain"));
    if (!ev) return;
    await guard(() => moveEvent(ev.id, day, null, null));
    await load();
  }

  const nowTop = $derived((now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_PX);
</script>

<section class="agenda">
  <div class="toolbar glass">
    <div class="nav">
      <button onclick={() => shift(-1)} aria-label="Précédent">←</button>
      <button onclick={() => (anchor = t)}>Aujourd'hui</button>
      <button onclick={() => shift(1)} aria-label="Suivant">→</button>
    </div>
    <h2>{title}</h2>
    <div class="seg" role="group" aria-label="Vue">
      <button class:on={mode === "week"} onclick={() => (mode = "week")}>Semaine</button>
      <button class:on={mode === "month"} onclick={() => (mode = "month")}>Mois</button>
    </div>
    <span class="grow"></span>
    <button class="secondary" onclick={() => openNew("memo")}>📌 Pense-bête</button>
    <button class="primary" onclick={() => openNew("event")}>＋ Rendez-vous</button>
  </div>

  {#if mode === "week"}
    <div class="week glass">
      <!-- Day headers + all-day row -->
      <div class="head">
        <div class="gutter"></div>
        {#each week as d, i (d)}
          <div class="dayhead" class:today={d === t}>
            <button class="daylabel" onclick={() => { mode = "week"; anchor = d; }}>{dayLabel(d, i)}</button>
            <div class="allday" class:drop={dropDay === `all-${d}`} role="list"
              ondragover={(e) => { e.preventDefault(); dropDay = `all-${d}`; }}
              ondragleave={() => (dropDay = null)}
              ondrop={(e) => dropOnAllDay(e, d)}>
              {#each allDayOf(d) as ev (ev.id)}
                <button class="chip {ev.kind}" draggable="true" ondragstart={(e) => dragStart(e, ev)}
                  onclick={() => (dialog = { event: ev, initial: { kind: ev.kind, day: ev.day, start: null, end: null } })}>
                  {ev.kind === "memo" ? "📌" : "📅"} {ev.title}
                </button>
              {/each}
              {#each tasksOf(d) as tk (tk.id)}
                <label class="chip task" class:done={tk.status === "done"} title="Tâche (échéance)">
                  <input type="checkbox" checked={tk.status === "done"} onchange={(e) => toggleTask(tk.id, e.currentTarget.checked)} />
                  <span>{priorityOf(tk.priority).dot} {tk.title}</span>
                </label>
              {/each}
              {#each notesOf(d) as n (n.id)}
                <button class="chip note" onclick={() => openNoteById(n.id)} title="Note modifiée ce jour">📝 {n.title ?? "Sans titre"}</button>
              {/each}
              {#each entriesOf(d) as en (en.id)}
                {@const cat = catOf(en.categoryId)}
                {#if cat}
                  <span class="chip entry" title={formatEntryData(cat, en.data)} style:border-color={cat.color ?? "var(--border)"}>
                    {cat.icon ?? "•"} {cat.name}
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- Hour grid -->
      <div class="hours" bind:this={grid}>
        <div class="inner" style:height="{24 * HOUR_PX}px">
          <div class="gutter">
            {#each Array.from({ length: 24 }, (_, h) => h) as h (h)}
              <span class="hour" style:top="{h * HOUR_PX}px">{h ? `${h}h` : ""}</span>
            {/each}
          </div>
          {#each week as d (d)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="col" class:today={d === t} class:drop={dropDay === d}
              onclick={(e) => slotClick(e, d)}
              ondragover={(e) => { e.preventDefault(); dropDay = d; }}
              ondragleave={() => (dropDay = null)}
              ondrop={(e) => dropOnHours(e, d)}>
              {#each placed(d) as p (p.item.id)}
                <button class="event {p.item.kind}" draggable="true" ondragstart={(e) => dragStart(e, p.item)}
                  style:top="{(p.start / 60) * HOUR_PX}px"
                  style:height="{Math.max(((p.end - p.start) / 60) * HOUR_PX - 2, 18)}px"
                  style:left="calc({(p.col / p.cols) * 100}% + 2px)"
                  style:width="calc({100 / p.cols}% - 4px)"
                  onclick={(e) => { e.stopPropagation(); dialog = { event: p.item, initial: { kind: p.item.kind, day: p.item.day, start: null, end: null } }; }}>
                  <span class="time">{formatMinutes(p.start)}{p.item.endAt ? `–${formatMinutes(p.end)}` : ""}</span>
                  <span class="etitle">{p.item.kind === "memo" ? "📌 " : ""}{p.item.title}{p.item.noteId ? " 📝" : ""}</span>
                  {#if p.item.location}<span class="loc">{p.item.location}</span>{/if}
                </button>
              {/each}
              {#if d === t}<div class="now" style:top="{nowTop}px"></div>{/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="month glass">
      {#each DAY_NAMES as n (n)}<div class="mname">{n}</div>{/each}
      {#each month as row, w (w)}
        {#each row as d (d)}
          {@const items = [
            ...allDayOf(d).map((e) => ({ k: e.id, label: `${e.kind === "memo" ? "📌" : "📅"} ${e.title}` })),
            ...timedOf(d).map((e) => ({ k: e.id, label: `${formatMinutes(minutesOf(e.startAt!))} ${e.title}` })),
            ...tasksOf(d).map((x) => ({ k: x.id, label: `${x.status === "done" ? "✓" : "☐"} ${x.title}` })),
          ]}
          {@const extra = notesOf(d).length + entriesOf(d).length}
          <button class="cell" class:other={d.slice(0, 7) !== anchor.slice(0, 7)} class:today={d === t}
            onclick={() => { anchor = d; mode = "week"; }}>
            <span class="num">{Number(d.slice(8))}</span>
            {#each items.slice(0, 3) as it (it.k)}<span class="mitem">{it.label}</span>{/each}
            {#if items.length > 3}<span class="more">+{items.length - 3}</span>{/if}
            {#if extra}<span class="more">📝 {extra}</span>{/if}
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</section>

{#if dialog}
  <EventDialog event={dialog.event} initial={dialog.initial} onsave={save} ondelete={remove} onnote={openNote}
    oncancel={() => (dialog = null)} />
{/if}

<style>
  .agenda { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 0; max-width: 1400px; width: 100%; margin: 0 auto; }
  .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--radius); }
  .toolbar h2 { margin: 0; font-size: 18px; font-weight: 600; min-width: 200px; }
  .nav { display: flex; gap: 4px; }
  button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font: inherit; font-size: 14px;
  }
  button:hover { border-color: var(--accent); }
  .primary { background: var(--accent); color: var(--on-accent); border: none; font-weight: 600; }
  .seg { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button { border: none; border-radius: 0; background: transparent; color: var(--text-muted); }
  .seg button.on { background: var(--surface-strong); color: var(--text); }
  .grow { flex: 1; }

  /* week */
  .week { display: flex; flex-direction: column; flex: 1; min-height: 0; border-radius: var(--radius); overflow: hidden; }
  .head { display: grid; grid-template-columns: 48px repeat(7, 1fr); border-bottom: 1px solid var(--border); }
  .dayhead { border-left: 1px solid var(--border); min-width: 0; }
  .dayhead.today .daylabel { color: var(--accent); font-weight: 700; }
  .daylabel { display: block; width: 100%; background: none; border: none; border-radius: 0; padding: 6px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .allday { display: flex; flex-direction: column; gap: 3px; padding: 4px; min-height: 30px; max-height: 120px; overflow: auto; }
  .allday.drop { background: var(--accent-soft); }
  .chip {
    display: flex; align-items: center; gap: 4px; text-align: left; width: 100%;
    font-size: 12px; padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--surface-strong); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .chip span { overflow: hidden; text-overflow: ellipsis; }
  .chip.memo { border-color: var(--warn); }
  .chip.event { border-color: var(--accent); }
  .chip.task input { margin: 0; accent-color: var(--accent); }
  .chip.task.done span { text-decoration: line-through; color: var(--text-muted); }
  .chip.note { color: var(--text-muted); }
  .chip.entry { color: var(--text-muted); cursor: default; }
  .hours { flex: 1; overflow: auto; min-height: 0; }
  .inner { position: relative; display: grid; grid-template-columns: 48px repeat(7, 1fr); }
  .gutter { position: relative; }
  .hour { position: absolute; right: 6px; transform: translateY(-50%); font-size: 11px; color: var(--text-muted); }
  .col {
    position: relative; border-left: 1px solid var(--border); cursor: cell;
    background-image: repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 48px);
  }
  .col.today { background-color: var(--accent-faint); }
  .col.drop { background-color: var(--accent-soft); }
  .event {
    position: absolute; display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
    padding: 3px 6px; border-radius: 6px; overflow: hidden; text-align: left; cursor: grab;
    background: var(--accent-soft); border: 1px solid var(--accent); font-size: 12px;
  }
  .event.memo { background: color-mix(in srgb, var(--warn) 22%, transparent); border-color: var(--warn); }
  .event .time { color: var(--text-muted); font-size: 11px; }
  .etitle { font-weight: 600; line-height: 1.2; }
  .loc { color: var(--text-muted); font-size: 11px; }
  .now { position: absolute; left: 0; right: 0; height: 2px; background: var(--error); pointer-events: none; }

  /* month */
  .month { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: auto; gap: 4px; flex: 1; min-height: 0; overflow: auto; padding: 8px; border-radius: var(--radius); }
  .mname { text-align: center; color: var(--text-muted); font-size: 12px; padding: 4px; }
  .cell {
    display: flex; flex-direction: column; align-items: stretch; gap: 2px; min-height: 96px; text-align: left;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px; overflow: hidden;
  }
  .cell.other { opacity: 0.45; }
  .cell.today { border-color: var(--accent); }
  .num { font-size: 13px; font-weight: 600; }
  .cell.today .num { color: var(--accent); }
  .mitem { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  .more { font-size: 11px; color: var(--text-muted); }
</style>
