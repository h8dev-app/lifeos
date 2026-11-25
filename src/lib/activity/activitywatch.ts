/** Read ActivityWatch (local server) for one day. Nothing is copied to SQLite. */
import { AW_PORT, localFetch } from "../localFetch";
import { activeSpans, type AfkData, type AwEvent, type Span, type WindowData } from "./aggregate";

const BASE = "/api/0";
export const AW_DOWNLOAD_URL = "https://activitywatch.net/downloads/";

interface Bucket { id: string; type: string; last_updated?: string }

export type AwDay =
  | { ok: true; spans: Span[]; hasAfk: boolean }
  | { ok: false; reason: string };

async function getJson<T>(path: string): Promise<T> {
  const res = await localFetch(AW_PORT, path);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body) as T;
}

/** Most recently updated bucket of a given type (one per watcher/host). */
function pick(buckets: Bucket[], type: string): Bucket | undefined {
  return buckets
    .filter((b) => b.type === type)
    .sort((a, b) => (b.last_updated ?? "").localeCompare(a.last_updated ?? ""))[0];
}

async function events<D>(bucket: string, from: Date, to: Date): Promise<AwEvent<D>[]> {
  const q = `start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}&limit=-1`;
  return getJson<AwEvent<D>[]>(`${BASE}/buckets/${encodeURIComponent(bucket)}/events?${q}`);
}

/** Active window spans between `from` and `to`. */
export async function loadAwDay(from: Date, to: Date): Promise<AwDay> {
  let buckets: Bucket[];
  try {
    buckets = Object.values(await getJson<Record<string, Bucket>>(`${BASE}/buckets/`));
  } catch (e) {
    return { ok: false, reason: `ActivityWatch injoignable sur http://127.0.0.1:5600 (${e}).` };
  }
  const win = pick(buckets, "currentwindow");
  if (!win) return { ok: false, reason: "ActivityWatch tourne, mais aucun suivi des fenêtres (watcher « window » absent)." };
  const afk = pick(buckets, "afkstatus");
  try {
    const [w, a] = await Promise.all([
      events<WindowData>(win.id, from, to),
      afk ? events<AfkData>(afk.id, from, to) : Promise.resolve(null),
    ]);
    return { ok: true, spans: activeSpans(w, a, from.getTime(), to.getTime()), hasAfk: !!afk };
  } catch (e) {
    return { ok: false, reason: `Lecture ActivityWatch impossible : ${e}` };
  }
}
