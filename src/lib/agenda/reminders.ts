/**
 * Reminder loop: every 30 s while LifeOS runs (even hidden), show a system
 * notification for agenda items whose reminder time has come.
 */
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { listEvents, markReminded } from "../db/events";
import { addDays, today } from "../dates";
import { dueReminders, formatMinutes, minutesOf } from "./agenda";

let allowed: boolean | null = null;

async function canNotify(): Promise<boolean> {
  if (allowed !== null) return allowed;
  allowed = await isPermissionGranted();
  if (!allowed) allowed = (await requestPermission()) === "granted";
  return allowed;
}

export async function checkReminders(): Promise<void> {
  // Yesterday → in 2 days covers "la veille" reminders and late ones.
  const t = today();
  const events = await listEvents(addDays(t, -1), addDays(t, 2));
  const due = dueReminders(events, new Date());
  if (due.length === 0 || !(await canNotify())) return;
  for (const e of due) {
    const when = e.allDay || !e.startAt ? (e.day === t ? "aujourd'hui" : e.day) : formatMinutes(minutesOf(e.startAt));
    sendNotification({
      title: `${e.kind === "memo" ? "Pense-bête" : "Rendez-vous"} : ${e.title}`,
      body: [when, e.location].filter(Boolean).join(" · "),
    });
    await markReminded(e.id);
  }
}

export const REMINDER_INTERVAL_MS = 30_000;
