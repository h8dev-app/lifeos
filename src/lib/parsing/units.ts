/**
 * Read one token with a unit. Each function returns the value in the base
 * unit (minutes, kilometers, euros) or `null` if the token does not match.
 * Decimal separator: `.` or `,`.
 */

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

const toNumber = (s: string) => Number(s.replace(",", "."));
const round2 = (n: number) => Math.round(n * 100) / 100;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `28min`, `45mn`, `1h`, `1h20`, `1h20min`, `1.5h` → minutes. */
export function parseDuration(token: string): number | null {
  const t = token.toLowerCase();
  let m = t.match(/^(\d+)h(\d{1,2})(?:min|mn)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(new RegExp(`^${NUM}(?:h|heures?)$`));
  if (m) return Math.round(toNumber(m[1]) * 60);
  m = t.match(new RegExp(`^${NUM}(?:min|mn|minutes?)$`));
  if (m) return Math.round(toNumber(m[1]));
  return null;
}

/** `5km`, `5,5km`, `500m` → kilometers. */
export function parseDistance(token: string): number | null {
  const m = token.toLowerCase().match(new RegExp(`^${NUM}(km|m)$`));
  if (!m) return null;
  const value = toNumber(m[1]);
  return round2(m[2] === "m" ? value / 1000 : value);
}

/** `18€`, `18,50€`, `18.5€`, `18eur`, `18euros` → euros. */
export function parseMoney(token: string): number | null {
  const m = token.toLowerCase().match(new RegExp(`^${NUM}(?:€|eur|euros?)$`));
  return m ? round2(toNumber(m[1])) : null;
}

/** With a unit: `30pages` (unit `pages`). Without a unit: a plain number `30`. */
export function parseNumber(token: string, unit?: string): number | null {
  const suffix = unit ? escape(unit.toLowerCase()) : "";
  const m = token.toLowerCase().match(new RegExp(`^${NUM}${suffix}$`));
  return m ? round2(toNumber(m[1])) : null;
}

/** True for a bare number such as `18` or `18,5`, which may be followed by its unit (`18 €`). */
export const isBareNumber = (token: string) => new RegExp(`^${NUM}$`).test(token);
