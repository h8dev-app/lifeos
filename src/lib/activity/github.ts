/**
 * GitHub public events → entries of the system category "code".
 * Polled every 10 minutes; `external_id` (github:<event id>) avoids duplicates.
 */
import type { EntryData } from "../types";
import { secretExists, secureFetch } from "../secrets";

/** Id of the "code" category (src-tauri/migrations/0002_seed.sql). */
export const CODE_CATEGORY_ID = "00000000-0000-4000-8000-000000000005";

/** GitHub usernames: letters, digits, hyphens, max 39 chars. */
export const isValidGithubUser = (u: string) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(u);

export interface GithubEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: { name?: string };
  payload?: { size?: number; distinct_size?: number; commits?: unknown[]; ref?: string; before?: string; head?: string };
}

export interface NewGithubEntry {
  externalId: string;
  occurredAt: string;
  data: EntryData;
  /** Used to count commits when the event does not give the number. */
  compare?: { repo: string; before: string; head: string };
}

const SHA = /^[0-9a-f]{40}$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;

/** Keep PushEvents. Commit count when GitHub gives it; otherwise the branch. */
export function pushEventsToEntries(events: GithubEvent[]): NewGithubEntry[] {
  return events
    .filter((e) => e.type === "PushEvent" && e.id && e.created_at)
    .map((e) => {
      const data: EntryData = { repo: e.repo?.name ?? "?" };
      const p = e.payload ?? {};
      const commits = p.size ?? p.distinct_size ?? (Array.isArray(p.commits) ? p.commits.length : undefined);
      if (typeof commits === "number" && commits > 0) data.commits = commits;
      if (p.ref) data.note = p.ref.replace(/^refs\/heads\//, "");
      const entry: NewGithubEntry = { externalId: `github:${e.id}`, occurredAt: new Date(e.created_at).toISOString(), data };
      // Since 2025 GitHub no longer puts the commit list in push events.
      if (data.commits === undefined && REPO.test(String(data.repo)) && SHA.test(p.before ?? "") && SHA.test(p.head ?? "")) {
        entry.compare = { repo: String(data.repo), before: p.before!, head: p.head! };
      }
      return entry;
    });
}

/** Fetch the latest public events of `user` (token used if one is saved). */
export async function fetchGithubEvents(user: string): Promise<GithubEvent[]> {
  if (!isValidGithubUser(user)) throw new Error(`Pseudo GitHub invalide : « ${user} ».`);
  const token = await secretExists("github_token");
  const res = await secureFetch(
    `https://api.github.com/users/${user}/events?per_page=100`,
    "GET",
    undefined,
    token ? "github_token" : null,
  );
  if (res.status === 404) throw new Error(`Utilisateur GitHub « ${user} » introuvable.`);
  if (res.status === 401) throw new Error("Token GitHub refusé (401).");
  if (res.status === 403 || res.status === 429) throw new Error("GitHub : limite de requêtes atteinte, réessai plus tard.");
  if (res.status !== 200) throw new Error(`GitHub : erreur ${res.status}.`);
  return JSON.parse(res.body) as GithubEvent[];
}

/** Number of commits between two SHAs (GitHub compare API), or null. */
export async function countCommits(c: { repo: string; before: string; head: string }): Promise<number | null> {
  const token = await secretExists("github_token");
  const res = await secureFetch(
    `https://api.github.com/repos/${c.repo}/compare/${c.before}...${c.head}`,
    "GET",
    undefined,
    token ? "github_token" : null,
  );
  if (res.status !== 200) return null;
  const n = (JSON.parse(res.body) as { total_commits?: number }).total_commits;
  return typeof n === "number" && n > 0 ? n : null;
}

export interface RepoCommit {
  sha: string;
  message: string; // first line
  date: string; // ISO
  url: string;
}

const commitCache = new Map<string, { at: number; commits: RepoCommit[] }>();

/** Latest commits of a repository (cached 10 min: 60 requests/hour without token). */
export async function fetchRepoCommits(repo: string, count = 6): Promise<RepoCommit[]> {
  const cached = commitCache.get(repo);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.commits;
  const token = await secretExists("github_token");
  const res = await secureFetch(
    `https://api.github.com/repos/${repo}/commits?per_page=${count}`,
    "GET",
    undefined,
    token ? "github_token" : null,
  );
  if (res.status === 404) throw new Error(`Dépôt « ${repo} » introuvable (ou privé sans token).`);
  if (res.status === 409) return []; // empty repository
  if (res.status === 403 || res.status === 429) throw new Error("GitHub : limite de requêtes atteinte, réessai plus tard.");
  if (res.status !== 200) throw new Error(`GitHub : erreur ${res.status}.`);
  type Raw = { sha: string; html_url: string; commit: { message: string; author?: { date?: string }; committer?: { date?: string } } };
  const commits = (JSON.parse(res.body) as Raw[]).map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
    url: c.html_url,
  }));
  commitCache.set(repo, { at: Date.now(), commits });
  return commits;
}
