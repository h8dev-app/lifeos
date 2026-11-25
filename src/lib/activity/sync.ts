/** GitHub polling: every 10 minutes while the app runs (even hidden). */
import { addExternalEntries, knownExternalIds } from "../db/entries";
import { CODE_CATEGORY_ID, countCommits, fetchGithubEvents, pushEventsToEntries } from "./github";

/** Max compare calls per sync (60 requests/hour without token). */
const MAX_COMPARES = 10;

export const GITHUB_POLL_MS = 10 * 60_000;

export type GithubSyncState = { at: string; added: number } | { at: string; error: string } | null;

export async function syncGithub(user: string): Promise<{ added: number }> {
  const events = await fetchGithubEvents(user);
  const all = pushEventsToEntries(events);
  const known = await knownExternalIds(all.map((e) => e.externalId));
  const fresh = all.filter((e) => !known.has(e.externalId));
  // Commit counts only for new pushes, newest first.
  for (const e of fresh.slice(0, MAX_COMPARES)) {
    if (!e.compare) continue;
    const n = await countCommits(e.compare).catch(() => null);
    if (n !== null) e.data.commits = n;
  }
  const added = await addExternalEntries(CODE_CATEGORY_ID, "github", fresh);
  return { added };
}
