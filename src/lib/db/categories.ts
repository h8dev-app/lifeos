import { parseFieldsSchema } from "../parsing/schema";
import type { NewCategory } from "../parsing/slash";
import type { Category } from "../types";
import { getDb, newId, nowIso } from "./client";

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  fields_schema: string | null;
  is_system: number;
}

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  icon: r.icon,
  color: r.color,
  schema: parseFieldsSchema(r.fields_schema),
  isSystem: r.is_system === 1,
});

/** Colors given to new categories, in turn. */
const PALETTE = ["#4ade80", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#2dd4bf", "#f472b6", "#fb923c"];

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY is_system, name",
  );
  return rows.map(toCategory);
}

export async function createCategory(input: NewCategory): Promise<void> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM categories");
  const now = nowIso();
  await db.execute(
    `INSERT INTO categories (id, slug, name, icon, color, fields_schema, is_system, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $7)`,
    [newId(), input.slug, input.name, input.icon, PALETTE[n % PALETTE.length],
     JSON.stringify({ fields: input.fields }), now],
  );
}
